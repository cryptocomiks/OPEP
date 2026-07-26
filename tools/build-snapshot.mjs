#!/usr/bin/env node
/**
 * Construit un instantané des articles de lanation.dj au moment du build.
 *
 * Le navigateur du visiteur ne peut pas toujours appeler l'API WordPress de
 * lanation.dj (CORS, pare-feu). Le runner GitHub Actions, lui, a un accès
 * Internet complet : on fige donc ici les articles dans un data.json servi
 * par notre propre site. La page l'affiche instantanément, puis tente un
 * rafraîchissement live en arrière-plan.
 *
 * Usage : node tools/build-snapshot.mjs <fichier-de-sortie>
 * N'échoue jamais le build : en cas de problème, écrit un instantané vide.
 */

const OUT = process.argv[2] || "lanation/data.json";
const API = "https://www.lanation.dj/wp-json/wp/v2";
const PER_PAGE = 18;
const PAGES = 3;               // ≈ 54 articles figés
const TIMEOUT = 20000;

const decode = (s = "") => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
  .replace(/&laquo;/g, "«").replace(/&raquo;/g, "»")
  .replace(/&hellip;/g, "…").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
  .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&agrave;/g, "à")
  .replace(/&ccedil;/g, "ç").replace(/&ecirc;/g, "ê").replace(/&ocirc;/g, "ô")
  .replace(/&quot;/g, '"').replace(/&#8217;/g, "’")
  .replace(/&amp;/g, "&");

const strip = (html = "") => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

async function get(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(API + path, {
      signal: ctl.signal,
      headers: { "User-Agent": "lanation-redesign-build/1.0", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}`);
    return res.json();
  } finally { clearTimeout(t); }
}

function normalize(p) {
  const media = p._embedded?.["wp:featuredmedia"]?.[0];
  const sizes = media?.media_details?.sizes || {};
  const pick = (...keys) => keys.map(k => sizes[k]?.source_url).find(Boolean);
  const terms = (p._embedded?.["wp:term"] || []).flat().filter(t => t?.taxonomy === "category");
  const skip = new Set(["non-classe", "uncategorized", "non-classifiee"]);
  const cat = terms.find(t => !skip.has(t.slug)) || terms[0];
  const excerpt = strip(p.excerpt?.rendered || "");
  return {
    id: p.id,
    title: decode(p.title?.rendered || "Sans titre"),
    excerpt: excerpt.length > 260 ? excerpt.slice(0, 257).trimEnd() + "…" : excerpt,
    date: p.date_gmt ? p.date_gmt + "Z" : p.date,
    link: p.link,
    img: pick("large", "medium_large", "full") || media?.source_url || null,
    imgAlt: decode(media?.alt_text || ""),
    cat: cat ? decode(cat.name) : "Actualité",
    catId: cat?.id ?? null,
    words: Math.max(120, Math.round(excerpt.length * 8)),
  };
}

const snapshot = { generated: new Date().toISOString(), source: "wp-json", cats: [], posts: [] };

try {
  const cats = await get("/categories?per_page=100&orderby=count&order=desc&_fields=id,name,slug,count");
  const skip = new Set(["non-classe", "uncategorized", "non-classifiee"]);
  let list = cats.filter(c => c.count > 0 && !skip.has(c.slug))
    .map(c => ({ id: c.id, name: decode(c.name), slug: c.slug, count: c.count }));
  const first = list.find(c => c.slug === "actualite");
  if (first) list = [first, ...list.filter(c => c !== first)];
  snapshot.cats = list.slice(0, 12);
  console.log(`✓ ${snapshot.cats.length} rubriques`);
} catch (e) {
  console.warn("⚠︎ rubriques indisponibles :", e.message);
}

const fields = "id,date,date_gmt,link,title,excerpt,categories,_links,_embedded";
for (let page = 1; page <= PAGES; page++) {
  try {
    const posts = await get(`/posts?per_page=${PER_PAGE}&page=${page}&_embed=wp:featuredmedia,wp:term&_fields=${fields}`);
    if (!Array.isArray(posts) || !posts.length) break;
    snapshot.posts.push(...posts.map(normalize));
    console.log(`✓ page ${page} : ${posts.length} articles`);
  } catch (e) {
    console.warn(`⚠︎ page ${page} indisponible :`, e.message);
    break;
  }
}

// Dédoublonnage défensif (l'API peut renvoyer un article sur deux pages).
const seen = new Set();
snapshot.posts = snapshot.posts.filter(p => !seen.has(p.id) && seen.add(p.id));

const { writeFile, mkdir } = await import("node:fs/promises");
const { dirname } = await import("node:path");
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot));
console.log(`→ ${OUT} : ${snapshot.posts.length} articles, ${snapshot.cats.length} rubriques`);

if (!snapshot.posts.length) console.warn("⚠︎ instantané vide : la page basculera en mode démonstration.");

#!/usr/bin/env node
/**
 * Récupère les polices de la refonte depuis Google Fonts et les auto-héberge
 * dans lanation/assets/fonts/ (woff2 + feuille @font-face locale).
 *
 *   node tools/fetch-fonts.mjs
 *
 * Pourquoi auto-héberger : aucune dépendance externe au chargement, pas de
 * requête tierce, rendu identique même si Google Fonts est inaccessible.
 * Ces trois familles sont sous licence SIL Open Font License 1.1, qui
 * autorise explicitement la redistribution.
 *
 * Passe par curl afin d'utiliser le proxy HTTPS de l'environnement.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const DIR = "lanation/assets/fonts";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// Sous-ensembles conservés : latin (base) et latin-ext (œ, ï, ç…).
const KEEP = new Set(["latin", "latin-ext"]);

const FAMILIES = [
  { css: "Pinyon+Script", label: "pinyon-script" },
  { css: "Playfair+Display:ital,wght@0,400..800;1,400..700", label: "playfair-display" },
  { css: "Newsreader:ital,wght@0,400;0,500;1,400", label: "newsreader" },
];

const curl = (url, binary = false) => execFileSync(
  "curl",
  ["-sSL", "--compressed", "-A", UA, url, ...(binary ? ["--output", "-"] : [])],
  { maxBuffer: 1 << 26, encoding: binary ? "buffer" : "utf8" }
);

mkdirSync(DIR, { recursive: true });

let out = `/* Polices auto-hébergées — SIL Open Font License 1.1
 * Pinyon Script · Playfair Display · Newsreader
 * Généré par tools/fetch-fonts.mjs — ne pas modifier à la main.
 */\n`;
let count = 0, bytes = 0;

for (const fam of FAMILIES) {
  const css = curl(`https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`);
  const blocks = css.split("@font-face").slice(1);
  let idx = 0;

  for (const raw of blocks) {
    const subset = (raw.match(/\/\*\s*([a-z0-9-]+)\s*\*\//i) || [])[1]
      || (css.slice(0, css.indexOf(raw)).match(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*$/i) || [])[1];
    const url = (raw.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!url) continue;

    // Le commentaire de sous-ensemble précède le bloc : on le retrouve dans le CSS global.
    const at = css.indexOf(raw);
    const before = css.slice(Math.max(0, at - 220), at);
    const sub = (before.match(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*$/i) || [])[1] || subset || "latin";
    if (!KEEP.has(sub)) continue;

    const style = /font-style:\s*italic/.test(raw) ? "italic" : "normal";
    const name = `${fam.label}-${sub}-${style}-${idx++}.woff2`;
    const buf = curl(url, true);
    writeFileSync(`${DIR}/${name}`, buf);
    bytes += buf.length; count++;

    const body = raw
      .replace(/url\(https:[^)]+\)\s*format\('woff2'\)/, `url('${name}') format('woff2')`)
      .replace(/^\s*\{/, "{");
    out += `@font-face ${body.trim()}\n`;
    console.log(`✓ ${name} (${(buf.length / 1024).toFixed(1)} ko)`);
  }
}

writeFileSync(`${DIR}/fonts.css`, out);
console.log(`\n→ ${count} fichiers, ${(bytes / 1024).toFixed(0)} ko au total, ${DIR}/fonts.css écrit`);

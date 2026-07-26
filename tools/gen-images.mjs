#!/usr/bin/env node
/**
 * Génère les visuels décoratifs de la refonte via Imagen 4 Fast
 * (le modèle image le moins cher de l'API Gemini : ≈ 0,02 $ / image).
 *
 *   GEMINI_API_KEY=xxx node tools/gen-images.mjs           # les 6 visuels
 *   GEMINI_API_KEY=xxx node tools/gen-images.mjs masthead  # un seul
 *
 * À exécuter UNE FOIS : les fichiers produits sont commités dans
 * lanation/assets/ et ne sont jamais régénérés automatiquement.
 *
 * Choix volontaire : uniquement des textures et des vues abstraites —
 * aucune scène d'actualité, aucun visage, aucun logo. Ces visuels sont
 * de la décoration (fond de titre, vignettes de repli quand un article
 * n'a pas de photo) et ne doivent jamais pouvoir passer pour une
 * photographie de presse réelle.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!KEY) {
  console.error("✗ GEMINI_API_KEY manquante.\n  GEMINI_API_KEY=… node tools/gen-images.mjs");
  process.exit(1);
}

const MODEL = "imagen-4.0-fast-generate-001";
const PRICE = 0.02; // $ par image, ordre de grandeur
const OUT_DIR = "lanation/assets";

const STYLE =
  "peinture abstraite haut de gamme, encre et lavis d'aquarelle, feuille d'or fin, " +
  "grain de papier texturé, composition minimaliste et élégante, éclairage doux, " +
  "palette encre noire profonde, sable chaud, or champagne, aucun texte, aucun visage, " +
  "aucun logo, aucune personne, style éditorial de magazine de luxe";

const JOBS = [
  { name: "masthead", ratio: "16:9",
    prompt: `Vaste horizon marin abstrait de la mer Rouge à l'aube, lignes calligraphiques dorées suggérant le vent sur l'eau, ${STYLE}` },
  { name: "cat-actualite", ratio: "16:9",
    prompt: `Composition abstraite évoquant des feuilles de journal pliées et de l'encre qui se diffuse, ${STYLE}` },
  { name: "cat-politique", ratio: "16:9",
    prompt: `Colonnade géométrique abstraite et arches minimalistes baignées d'une lumière dorée, ${STYLE}` },
  { name: "cat-economie", ratio: "16:9",
    prompt: `Formes abstraites de conteneurs portuaires et de grues réduites à des blocs géométriques, reflets dorés sur l'eau, ${STYLE}` },
  { name: "cat-societe", ratio: "16:9",
    prompt: `Motif abstrait de tissage textile et de nattes tressées, ombres douces, fils dorés, ${STYLE}` },
  { name: "cat-culture", ratio: "16:9",
    prompt: `Volutes calligraphiques à l'encre et éclats de feuille d'or sur papier sable, mouvement de pinceau à la main, ${STYLE}` },
];

const only = process.argv.slice(2);
const jobs = only.length ? JOBS.filter(j => only.includes(j.name)) : JOBS;
if (!jobs.length) { console.error("✗ aucun visuel ne correspond :", only.join(", ")); process.exit(1); }

console.log(`${jobs.length} image(s) · ${MODEL} · coût estimé ≈ ${(jobs.length * PRICE).toFixed(2)} $\n`);
await mkdir(OUT_DIR, { recursive: true });

let ok = 0;
for (const job of jobs) {
  process.stdout.write(`· ${job.name} … `);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`,
      {
        method: "POST",
        headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: job.prompt }],
          parameters: { sampleCount: 1, aspectRatio: job.ratio, personGeneration: "dont_allow" },
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
    const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("réponse sans image : " + JSON.stringify(json).slice(0, 220));

    const png = `${OUT_DIR}/${job.name}.png`;
    await writeFile(png, Buffer.from(b64, "base64"));

    // Conversion WebP si l'outil est disponible (poids ÷ 4 environ).
    let final = png;
    for (const conv of [
      ["cwebp", ["-q", "76", "-resize", "1280", "0", png, "-o", `${OUT_DIR}/${job.name}.webp`]],
      ["convert", [png, "-resize", "1280x", "-quality", "76", `${OUT_DIR}/${job.name}.webp`]],
    ]) {
      try {
        execFileSync(conv[0], conv[1], { stdio: "ignore" });
        final = `${OUT_DIR}/${job.name}.webp`;
        execFileSync("rm", ["-f", png]);
        break;
      } catch {}
    }
    console.log("✓ " + final);
    ok++;
  } catch (e) {
    console.log("✗ " + e.message);
  }
}

console.log(`\n${ok}/${jobs.length} générée(s) · dépense réelle ≈ ${(ok * PRICE).toFixed(2)} $`);

#!/usr/bin/env node
/* ============================================================
   Fractal Arena — app Android : icônes et écran de lancement.

   Sources : les fichiers PWA du client web (assets/pwa/), pas des images
   retapées à la main — la marque reste la même sur toutes les surfaces.

     icon-maskable-512.png  art réduit à 72 % sur fond #05070f → icône
                            classique (Android < 8) et icône ronde.
     icon-512.png           art sur TRANSPARENT (46 % de pixels vides,
                            vérifié) → couche avant des icônes adaptatives
                            (Android 8+), à 66 % du calque 108dp pour
                            rester dans la zone sûre du gabarit système.
     splash                 fond #05070f + emblème centré, aux 5 densités,
                            portrait ET paysage.

   À relancer seulement si l'emblème change : les PNG produits sont
   versionnés dans le dépôt (res/), l'app ne les génère pas au build.
   ============================================================ */

import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Même règle que sync-web.mjs : source par défaut le clone voisin, ou le
// worktree pinné sur origin/main (FA_WEB_DIR).
const WEB = process.env.FA_WEB_DIR ? resolve(process.env.FA_WEB_DIR) : resolve(ROOT, "..", "fractal-arena-web");
const RES = join(ROOT, "android", "app", "src", "main", "res");
const FOND = { r: 5, g: 7, b: 15, alpha: 1 };   // #05070f, le fond du jeu

const sharp = createRequire(join(WEB, "package.json"))("sharp");

const MASQUABLE = join(WEB, "assets", "pwa", "icon-maskable-512.png");
const ART = join(WEB, "assets", "pwa", "icon-512.png");
for (const f of [MASQUABLE, ART]) if (!existsSync(f)) { console.error("source absente : " + f); process.exit(1); }

const DENSITES = [["mdpi", 1], ["hdpi", 1.5], ["xhdpi", 2], ["xxhdpi", 3], ["xxxhdpi", 4]];
const PORT = [[320, 480], [480, 800], [720, 1280], [960, 1600], [1280, 1920]];

async function ecrire(chemin, buffer) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, buffer);
  console.log("  " + chemin.replace(ROOT + "\\", "").replace(/\\/g, "/"));
}

async function main() {
  console.log("Icônes :");
  for (const [dens, facteur] of DENSITES) {
    const n = Math.round(48 * facteur);              // icône classique
    const mip = join(RES, "mipmap-" + dens);
    await ecrire(join(mip, "ic_launcher.png"), await sharp(MASQUABLE).resize(n, n).png().toBuffer());

    // Icône ronde : même art, découpé au cercle.
    const rond = await sharp(MASQUABLE).resize(n, n).png().toBuffer();
    const masque = Buffer.from(
      `<svg width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="${n / 2}" fill="#fff"/></svg>`);
    await ecrire(join(mip, "ic_launcher_round.png"),
      await sharp(rond).composite([{ input: masque, blend: "dest-in" }]).png().toBuffer());

    // Couche avant adaptative : 108dp de calque, art à 66 % (zone sûre 72dp).
    const c = Math.round(108 * facteur);
    const art = await sharp(ART).resize(Math.round(c * 0.66), Math.round(c * 0.66)).png().toBuffer();
    await ecrire(join(mip, "ic_launcher_foreground.png"), await sharp({
      create: { width: c, height: c, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{
      input: art,
      left: Math.round((c - c * 0.66) / 2),
      top: Math.round((c - c * 0.66) / 2),
    }]).png().toBuffer());
  }

  console.log("Écran de lancement :");
  for (let i = 0; i < DENSITES.length; i++) {
    const [dens, facteur] = DENSITES[i];
    const [l, h] = PORT[i];
    for (const [nom, w, hh] of [["port", l, h], ["land", h, l]]) {
      const embleme = await sharp(ART).resize(Math.round(Math.min(w, hh) * 0.34)).png().toBuffer();
      const meta = await sharp(embleme).metadata();
      const img = await sharp({ create: { width: w, height: hh, channels: 4, background: FOND } })
        .composite([{ input: embleme, left: Math.round((w - meta.width) / 2), top: Math.round((hh - meta.height) / 2) }])
        .png().toBuffer();
      await ecrire(join(RES, `drawable-${nom}-${dens}`, "splash.png"), img);
    }
  }
  // Android 12+ : l'écran de lancement natif veut un DRAWABLE (pas un mipmap)
  // pour son icône animée — d'où cette copie de la couche avant.
  await ecrire(join(RES, "drawable", "splash_icon.png"), await sharp(ART).resize(432, 432).png().toBuffer());

  console.log("Terminé.");
}

main().catch((e) => { console.error("ÉCHEC — " + e.message); process.exit(1); });

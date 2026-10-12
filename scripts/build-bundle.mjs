#!/usr/bin/env node
/* ============================================================
   Fractal Arena — paquet de mise à jour du JEU pour l'app Android.

   Produit deux choses :
     bundle-<version>.zip   le client web complet (à téléverser en asset de
                            release : c'est ce que l'app téléchargera)
     app-bundle.json        { version, url } — l'app lit CE fichier au
                            démarrage pour savoir s'il y a plus récent

   Le JSON est versionné sur la branche main du dépôt de l'app : le pousser
   = publier la mise à jour. L'URL du zip est figée par version (jamais
   « latest ») pour qu'un cache CDN ne puisse pas servir les octets d'une
   version en annonçant une autre.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WWW = join(ROOT, "www");
const DIST = join(ROOT, "dist");

if (!existsSync(join(WWW, "index.html"))) {
  console.error("www/ absent : lancer d'abord `node scripts/sync-web.mjs`");
  process.exit(1);
}

const html = readFileSync(join(WWW, "index.html"), "utf8");
const versionClient = (html.match(/data\.js\?v=(\d+)/) || [])[1];
if (!versionClient) { console.error("version introuvable dans www/index.html"); process.exit(1); }

// Version du PAQUET, distincte de celle du client : quand on corrige l'app sans
// qu'une nouvelle version du jeu soit publiée, il faut tout de même un numéro
// supérieur, sinon les apps déjà installées ne verraient rien à mettre à jour.
// Convention : <versionClient> puis <versionClient>.1, .2, …
const fichierJson = join(ROOT, "app-bundle.json");
let version = versionClient;
if (existsSync(fichierJson)) {
  try {
    const ancien = JSON.parse(readFileSync(fichierJson, "utf8")).version || "";
    if (String(ancien).split(".")[0] === String(versionClient)) {
      const sous = Number(String(ancien).split(".")[1] || 0);
      version = versionClient + "." + (sous + 1);
    }
  } catch (e) { console.error("app-bundle.json illisible, on repart sur la version du client"); }
}

if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const zip = join(DIST, `bundle-${version}.zip`);

// Le paquet doit DIRE sa propre version : app-env.json est réécrit juste avant
// l'archivage (l'APK, elle, garde la version du client — c'est exact pour une
// installation neuve). Sans ça, une app mise à jour se croirait encore à la
// version précédente et retéléchargerait le même paquet.
const env = JSON.parse(readFileSync(join(WWW, "app-env.json"), "utf8"));
writeFileSync(join(WWW, "app-env.json"), JSON.stringify({ ...env, versionWeb: version, versionClient }, null, 2) + "\n", "utf8");

// Le zip est produit par scripts/zip-bundle.py : ni zip/7z sur le poste, et
// PowerShell n'a pas pu être lancé depuis Node. La bibliothèque standard de
// Python est présente et l'archive est vérifiable (testzip) après coup.
console.log("Compression de www/ (v" + version + ")…");
execFileSync("python", [join(ROOT, "scripts", "zip-bundle.py"), WWW, zip], { stdio: ["ignore", "inherit", "inherit"] });

if (!existsSync(zip)) { console.error("zip non produite : " + zip); process.exit(1); }
const mo = (statSync(zip).size / 1048576).toFixed(1);

const url = `https://github.com/Arthefacte/fractal-arena-mobile/releases/download/v${versionClient}/bundle-${version}.zip`;
writeFileSync(join(ROOT, "app-bundle.json"), JSON.stringify({ version, url }, null, 2) + "\n", "utf8");

console.log("\nPaquet : " + zip + "  (" + mo + " Mo)");
console.log("app-bundle.json écrit (version " + version + ") → " + url);
console.log("\nPublier :");
console.log("  gh release upload v" + versionClient + " \"" + join(DIST, `bundle-${version}.zip`) + "\" --repo Arthefacte/fractal-arena-mobile --clobber");
console.log("  puis committer + pousser app-bundle.json sur main (c'est CE fichier qui annonce la mise à jour).");

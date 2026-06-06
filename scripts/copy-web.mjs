// Copie le build web (sources + vendor) vers www/ pour Capacitor.
import { existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const www = resolve(root, "www");

const FILES = [
  "index.html",
  "styles.css",
  "mobile.css",
  "data.js",
  "i18n.js",
  "engine.js",
  "components.jsx",
  "arena.jsx",
  "screens.jsx",
  "app.jsx",
];
const DIRS = ["assets", "vendor"];

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const f of FILES) {
  const src = resolve(root, f);
  if (!existsSync(src)) throw new Error(`Fichier source manquant: ${f}`);
  cpSync(src, resolve(www, f));
}
for (const d of DIRS) {
  const src = resolve(root, d);
  if (!existsSync(src)) throw new Error(`Dossier source manquant: ${d}`);
  cpSync(src, resolve(www, d), { recursive: true });
}

console.log("www/ généré.");

#!/usr/bin/env node
/* ============================================================
   Fractal Arena — APK de release, prête à publier.

   Le nom du fichier livré est un CONTRAT PUBLIC : la vitrine pointe
   https://github.com/Arthefacte/fractal-arena-mobile/releases/latest/download/FractalArena-android.apk
   et ce lien doit rester vrai d'une version à l'autre. Gradle (AGP 8) ne
   permet plus de renommer la sortie depuis le build.gradle : on le fait donc
   ici, à un seul endroit, après le build.

   Publier : gh release create v<N> FractalArena-android.apk --repo
             Arthefacte/fractal-arena-mobile
   ============================================================ */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ecrireProvenance, verifierProvenance } from "./web-provenance.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "android");
const WWW = join(ROOT, "www");
const ASSETS_ANDROID = join(ANDROID, "app", "src", "main", "assets", "public");
const SORTIE = join(ANDROID, "app", "build", "outputs", "apk", "release", "app-release.apk");
const LIVRE = join(ROOT, "FractalArena-android.apk");

function node(args) {
  console.log("\n$ node " + args.join(" "));
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });
}

// Le build régénère www/ LUI-MÊME depuis FA_WEB_COMMIT. sync-web exige un
// dépôt propre au bon HEAD, puis lit les blobs du commit dans un snapshot
// isolé : le clone partagé vivant n'entre jamais dans la livraison.
node(["scripts/sync-web.mjs"]);
let provenance = verifierProvenance(WWW);

// L'APK embarque exactement le paquet publié : s'il existe un paquet pour la même
// version de client (335.1 après une correction de l'app), on étiquette l'APK avec
// cette version — sinon une installation neuve retéléchargerait 40 Mo pour rien.
try {
  const paquet = JSON.parse(readFileSync(join(ROOT, "app-bundle.json"), "utf8"));
  const client = (readFileSync(join(WWW, "index.html"), "utf8").match(/data\.js\?v=(\d+)/) || [])[1];
  const memeSource = paquet.webCommit === provenance.webCommit && paquet.webTree === provenance.webTree;
  if (client && memeSource && String(paquet.version).split(".")[0] === String(client)) {
    const p = join(WWW, "app-env.json");
    const env = JSON.parse(readFileSync(p, "utf8"));
    writeFileSync(p, JSON.stringify({ ...env, versionWeb: paquet.version }, null, 2) + "\n", "utf8");
    console.log("app-env.json étiqueté " + paquet.version + " (mêmes octets que le paquet publié)");
  }
} catch (e) { /* aucun paquet publié : l'APK garde la version du client */ }

// La seule mutation légitime après sync-web est l'étiquette de version ci-dessus.
// On recalcule son reçu, puis on refuse toute autre divergence avant et après
// la copie Capacitor vers les assets Android.
provenance = ecrireProvenance(WWW, provenance);
verifierProvenance(WWW);

node([join("node_modules", "@capacitor", "cli", "bin", "capacitor"), "sync", "android"]);
verifierProvenance(ASSETS_ANDROID);

console.log("\nBuild release (clé de ~/.fa-secrets/android/)…");
const args = [":app:assembleRelease", "--console=plain"];
// Sur Windows, Gradle s'appelle gradlew.bat et doit passer par cmd : appeler
// le .bat par son chemin absolu casse dès que le dossier contient une espace
// (« Arthefacte Games »). On se place dans android/ et on nomme le script nu.
if (process.platform === "win32") {
  execFileSync(process.env.ComSpec || "cmd.exe", ["/c", "gradlew.bat", ...args],
    { cwd: ANDROID, stdio: ["ignore", "inherit", "inherit"] });
} else {
  execFileSync("./gradlew", args, { cwd: ANDROID, stdio: ["ignore", "inherit", "inherit"] });
}

if (!existsSync(SORTIE)) {
  console.error("APK attendue absente : " + SORTIE);
  process.exit(1);
}
copyFileSync(SORTIE, LIVRE);
const mo = (statSync(LIVRE).size / 1048576).toFixed(1);
console.log("\nAPK livrable : " + LIVRE + "  (" + mo + " Mo)");
console.log("Publier avec :  gh release create v<version> \"FractalArena-android.apk\" --repo Arthefacte/fractal-arena-mobile");

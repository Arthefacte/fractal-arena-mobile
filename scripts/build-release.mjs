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
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "android");
const SORTIE = join(ANDROID, "app", "build", "outputs", "apk", "release", "app-release.apk");
const LIVRE = join(ROOT, "FractalArena-android.apk");

console.log("Build release (clé de ~/.fa-secrets/android/)…");
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

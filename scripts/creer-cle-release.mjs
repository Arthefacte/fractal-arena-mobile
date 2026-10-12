#!/usr/bin/env node
/* ============================================================
   Fractal Arena — clé de signature de l'app Android (release).

   Lance UNE fois. Crée, HORS du dépôt (~/.fa-secrets/android/) :
     - fractal-arena-release.jks      la clé elle-même
     - keystore.properties            chemin + mots de passe, pour Gradle

   Règles :
   - La clé ne va JAMAIS dans le dépôt, ni dans un message, ni dans un log.
     Le script n'affiche que des chemins.
   - Il REFUSE d'écraser une clé existante : la perdre, c'est perdre la
     continuité de mise à jour de l'app (les joueurs devraient désinstaller
     pour réinstaller une version signée autrement). La sauvegarder ailleurs
     que sur ce disque est une décision du fondateur, pas du script.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DOSSIER = join(homedir(), ".fa-secrets", "android");
const CLE = join(DOSSIER, "fractal-arena-release.jks");
const PROPS = join(DOSSIER, "keystore.properties");
const ALIAS = "fractalarena";

if (existsSync(CLE)) {
  console.error("Une clé existe déjà : " + CLE);
  console.error("Rien n'a été touché. Pour repartir d'une clé neuve, la déplacer d'abord à la main.");
  process.exit(1);
}

mkdirSync(DOSSIER, { recursive: true });
const mdp = randomBytes(24).toString("base64url");

console.log("Génération de la clé (RSA 4096, validité 10000 jours)…");
execFileSync("keytool", [
  "-genkeypair", "-keystore", CLE, "-alias", ALIAS,
  "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000",
  "-storepass", mdp, "-keypass", mdp,
  "-dname", "CN=Arthefacte Games, OU=Fractal Arena, O=Arthefacte, C=FR",
], { stdio: ["ignore", "ignore", "pipe"] });

// Gradle lit ce fichier ; il est hors du dépôt, donc jamais commité.
writeFileSync(PROPS, [
  "# Clé de signature release de l'app Android Fractal Arena.",
  "# À SAUVEGARDER hors de ce disque avec les mots de passe : perdre ce",
  "# fichier, c'est ne plus pouvoir livrer de mise à jour de l'app.",
  "storeFile=" + CLE.replace(/\\/g, "/"),
  "storePassword=" + mdp,
  "keyAlias=" + ALIAS,
  "keyPassword=" + mdp,
  "",
].join("\n"), { mode: 0o600 });

console.log("Clé  : " + CLE);
console.log("Props: " + PROPS + "  (contient les mots de passe — ne pas versionner)");
console.log("Empreinte SHA-256 du certificat :");
execFileSync("keytool", ["-list", "-v", "-keystore", CLE, "-alias", ALIAS, "-storepass", mdp],
  { stdio: ["ignore", "inherit", "ignore"] });

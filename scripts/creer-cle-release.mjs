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
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RACINE_SECRETS = join(homedir(), ".fa-secrets");
const DOSSIER = join(RACINE_SECRETS, "android");
const CLE = join(DOSSIER, "fractal-arena-release.jks");
const PROPS = join(DOSSIER, "keystore.properties");
const ALIAS = "fractalarena";

// Restreint aussi la création des fichiers par keytool, avant leur chmod explicite.
process.umask(0o077);

function creerOuSecuriserDossier(chemin) {
  const etat = lstatSync(chemin, { throwIfNoEntry: false });
  if (etat === undefined) {
    mkdirSync(chemin, { mode: 0o700 });
  } else if (etat.isSymbolicLink() || !etat.isDirectory()) {
    throw new Error("Le chemin des secrets doit être un dossier réel : " + chemin);
  }

  const etatFinal = lstatSync(chemin);
  if (etatFinal.isSymbolicLink() || !etatFinal.isDirectory()) {
    throw new Error("Le chemin des secrets a changé pendant sa vérification : " + chemin);
  }
  chmodSync(chemin, 0o700);
}

function verifierDossierExistant(chemin) {
  const etat = lstatSync(chemin, { throwIfNoEntry: false });
  if (etat !== undefined && (etat.isSymbolicLink() || !etat.isDirectory())) {
    throw new Error("Le chemin des secrets doit être un dossier réel : " + chemin);
  }
}

verifierDossierExistant(RACINE_SECRETS);
verifierDossierExistant(DOSSIER);
for (const sortie of [CLE, PROPS]) {
  if (lstatSync(sortie, { throwIfNoEntry: false }) !== undefined) {
    console.error("Un secret existe déjà : " + sortie);
    console.error("Rien n'a été touché. Pour repartir d'une clé neuve, déplacer les secrets d'abord à la main.");
    process.exit(1);
  }
}
creerOuSecuriserDossier(RACINE_SECRETS);
creerOuSecuriserDossier(DOSSIER);

const mdp = randomBytes(24).toString("base64url");
const dossierMdp = mkdtempSync(join(DOSSIER, ".keytool-"));
const fichierMdp = join(dossierMdp, "password");

try {
  chmodSync(dossierMdp, 0o700);
  writeFileSync(fichierMdp, mdp + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  chmodSync(fichierMdp, 0o600);

  console.log("Génération de la clé (RSA 4096, validité 10000 jours)…");
  execFileSync("keytool", [
    "-genkeypair", "-keystore", CLE, "-alias", ALIAS,
    "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000",
    "-storepass:file", fichierMdp, "-keypass:file", fichierMdp,
    "-dname", "CN=Arthefacte Games, OU=Fractal Arena, O=Arthefacte, C=FR",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const etatCle = lstatSync(CLE, { throwIfNoEntry: false });
  if (etatCle === undefined || etatCle.isSymbolicLink() || !etatCle.isFile()) {
    throw new Error("keytool n'a pas créé un fichier de clé sûr : " + CLE);
  }
  chmodSync(CLE, 0o600);

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
  ].join("\n"), { encoding: "utf8", flag: "wx", mode: 0o600 });
  chmodSync(PROPS, 0o600);

  console.log("Clé  : " + CLE);
  console.log("Props: " + PROPS + "  (contient les mots de passe — ne pas versionner)");
  console.log("Empreinte SHA-256 du certificat :");
  execFileSync("keytool", [
    "-list", "-v", "-keystore", CLE, "-alias", ALIAS, "-storepass:file", fichierMdp,
  ], { stdio: ["ignore", "inherit", "ignore"] });
} finally {
  if (lstatSync(fichierMdp, { throwIfNoEntry: false }) !== undefined) {
    unlinkSync(fichierMdp);
  }
  rmdirSync(dossierMdp);
}

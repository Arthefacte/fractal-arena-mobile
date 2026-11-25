import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export const DEPOT_WEB_ATTENDU = "github.com/Arthefacte/fractal-arena-web";
export const FICHIER_PROVENANCE = "release-provenance.json";

const EMPREINTE_GIT = /^[0-9a-f]{40}$/;
const EMPREINTE_SHA256 = /^[0-9a-f]{64}$/;

function erreur(message) {
  throw new Error("provenance du client web : " + message);
}

function gitTexte(repertoire, args) {
  try {
    return execFileSync("git", ["-C", repertoire, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (e) {
    const detail = e.stderr && String(e.stderr).trim();
    erreur("commande Git impossible" + (detail ? " : " + detail : ""));
  }
}

function depotCanonique(url) {
  let valeur = String(url || "").trim();
  valeur = valeur.replace(/^git@github\.com:/i, "https://github.com/");
  valeur = valeur.replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/");
  let parsed;
  try { parsed = new URL(valeur); } catch (e) { return ""; }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com"
      || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return "";
  const morceaux = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/");
  if (morceaux.length !== 2 || morceaux.some((m) => !m)) return "";
  return "github.com/" + morceaux.join("/");
}

function memeChemin(a, b) {
  const gauche = realpathSync(a);
  const droite = realpathSync(b);
  return process.platform === "win32"
    ? gauche.toLowerCase() === droite.toLowerCase()
    : gauche === droite;
}

function verifierDepot(env) {
  const sourceConfiguree = String(env.FA_WEB_DIR || "").trim();
  const commitConfigure = String(env.FA_WEB_COMMIT || "").trim().toLowerCase();
  if (!sourceConfiguree) erreur("FA_WEB_DIR est obligatoire pour une livraison");
  if (!EMPREINTE_GIT.test(commitConfigure)) {
    erreur("FA_WEB_COMMIT doit être le SHA-1 complet (40 caractères) du commit approuvé");
  }

  const source = resolve(sourceConfiguree);
  let info;
  try { info = lstatSync(source); } catch (e) { erreur("FA_WEB_DIR est introuvable : " + source); }
  if (info.isSymbolicLink()) erreur("FA_WEB_DIR ne doit pas être un lien symbolique : " + source);
  if (!info.isDirectory()) erreur("FA_WEB_DIR n'est pas un dossier : " + source);

  const racine = gitTexte(source, ["rev-parse", "--show-toplevel"]);
  if (!memeChemin(source, racine)) erreur("FA_WEB_DIR doit désigner la racine du dépôt Git : " + racine);

  const origine = depotCanonique(gitTexte(source, ["remote", "get-url", "origin"]));
  if (origine.toLowerCase() !== DEPOT_WEB_ATTENDU.toLowerCase()) {
    erreur("le remote origin doit être " + DEPOT_WEB_ATTENDU);
  }

  const commit = gitTexte(source, ["rev-parse", "--verify", commitConfigure + "^{commit}"]).toLowerCase();
  if (commit !== commitConfigure) erreur("FA_WEB_COMMIT ne désigne pas le commit approuvé exact");
  const head = gitTexte(source, ["rev-parse", "HEAD"]).toLowerCase();
  if (head !== commit) erreur("HEAD (" + head + ") diffère de FA_WEB_COMMIT (" + commit + ")");

  const etat = gitTexte(source, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (etat) erreur("le dépôt contient des fichiers suivis modifiés ou des fichiers non suivis");

  const arbre = gitTexte(source, ["rev-parse", commit + "^{tree}"]).toLowerCase();
  if (!EMPREINTE_GIT.test(arbre)) erreur("l'empreinte de l'arbre Git est invalide");
  return { source, commit, arbre };
}

function cheminSnapshot(racine, cheminGit) {
  if (!cheminGit || cheminGit.startsWith("/") || cheminGit.includes("\\")) {
    erreur("chemin Git non portable : " + cheminGit);
  }
  const morceaux = cheminGit.split("/");
  if (morceaux.some((m) => !m || m === "." || m === "..")) erreur("chemin Git non sûr : " + cheminGit);
  const cible = join(racine, ...morceaux);
  const rel = cible.slice(racine.length + 1);
  if (!rel || rel.startsWith(".." + sep) || resolve(cible) !== cible) erreur("chemin Git hors du snapshot : " + cheminGit);
  return cible;
}

function materialiserArbre(source, commit, destination) {
  let brut;
  try {
    brut = execFileSync("git", ["-C", source, "ls-tree", "-r", "-z", "--full-tree", commit], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    erreur("impossible de lire l'arbre du commit approuvé");
  }

  for (const entree of brut.split("\0")) {
    if (!entree) continue;
    const tab = entree.indexOf("\t");
    const entete = entree.slice(0, tab).split(" ");
    const cheminGit = entree.slice(tab + 1);
    if (tab < 0 || entete.length !== 3) erreur("entrée Git illisible dans le commit approuvé");
    const [mode, type, objet] = entete;
    if ((mode !== "100644" && mode !== "100755") || type !== "blob" || !EMPREINTE_GIT.test(objet)) {
      erreur("entrée Git non régulière interdite : " + cheminGit);
    }

    const cible = cheminSnapshot(destination, cheminGit);
    mkdirSync(dirname(cible), { recursive: true });
    let fd;
    try {
      fd = openSync(cible, "wx", mode === "100755" ? 0o755 : 0o644);
      execFileSync("git", ["-C", source, "cat-file", "blob", objet], {
        stdio: ["ignore", fd, "pipe"],
        windowsHide: true,
      });
      if (mode === "100755") chmodSync(cible, 0o755);
    } catch (e) {
      erreur("impossible de matérialiser le fichier approuvé : " + cheminGit);
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }
}

export function materialiserClientWebApprouve(env = process.env) {
  const depot = verifierDepot(env);
  const snapshot = mkdtempSync(join(tmpdir(), "fractal-arena-web-approuve-"));
  let present = true;
  const nettoyer = () => {
    if (!present) return;
    present = false;
    rmSync(snapshot, { recursive: true, force: true });
  };
  try {
    materialiserArbre(depot.source, depot.commit, snapshot);
    // Une session concurrente qui touche le worktree pendant la lecture ne peut
    // pas modifier les blobs adressés par leur hash, mais la livraison doit tout
    // de même échouer plutôt que masquer ce changement à l'opérateur.
    const apres = verifierDepot(env);
    if (apres.commit !== depot.commit || apres.arbre !== depot.arbre) {
      erreur("le commit approuvé a changé pendant la matérialisation");
    }
    return {
      repertoire: snapshot,
      provenance: {
        repository: DEPOT_WEB_ATTENDU,
        webCommit: depot.commit,
        webTree: depot.arbre,
      },
      nettoyer,
    };
  } catch (e) {
    nettoyer();
    throw e;
  }
}

function listerFichiers(racine, courant = "", resultat = []) {
  const dossier = courant ? join(racine, ...courant.split("/")) : racine;
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const rel = courant ? courant + "/" + entree.name : entree.name;
    if (rel === FICHIER_PROVENANCE) continue;
    if (entree.isSymbolicLink()) erreur("l'arbre généré contient un lien symbolique : " + rel);
    if (entree.isDirectory()) listerFichiers(racine, rel, resultat);
    else if (entree.isFile()) resultat.push(rel);
    else erreur("l'arbre généré contient une entrée non régulière : " + rel);
  }
  return resultat;
}

export function empreinteArbreGenere(racine) {
  const hash = createHash("sha256");
  for (const rel of listerFichiers(racine).sort()) {
    const contenu = readFileSync(join(racine, ...rel.split("/")));
    hash.update(rel, "utf8");
    hash.update("\0");
    hash.update(String(contenu.length), "utf8");
    hash.update("\0");
    hash.update(contenu);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function verifierChamps(provenance, commitAttendu = "") {
  if (!provenance || provenance.schemaVersion !== 1) erreur("reçu de livraison absent ou de version inconnue");
  if (provenance.repository !== DEPOT_WEB_ATTENDU) erreur("dépôt inattendu dans le reçu de livraison");
  if (!EMPREINTE_GIT.test(provenance.webCommit || "")) erreur("commit invalide dans le reçu de livraison");
  if (!EMPREINTE_GIT.test(provenance.webTree || "")) erreur("arbre Git invalide dans le reçu de livraison");
  if (!EMPREINTE_SHA256.test(provenance.generatedTreeSha256 || "")) erreur("empreinte générée invalide dans le reçu de livraison");
  if (commitAttendu && provenance.webCommit !== commitAttendu.toLowerCase()) {
    erreur("le reçu ne correspond pas à FA_WEB_COMMIT");
  }
}

export function ecrireProvenance(racine, source) {
  const base = {
    schemaVersion: 1,
    repository: source.repository,
    webCommit: source.webCommit,
    webTree: source.webTree,
    generatedTreeSha256: empreinteArbreGenere(racine),
  };
  verifierChamps(base, source.webCommit);
  writeFileSync(join(racine, FICHIER_PROVENANCE), JSON.stringify(base, null, 2) + "\n", "utf8");
  return base;
}

export function verifierProvenance(racine, commitAttendu = process.env.FA_WEB_COMMIT || "") {
  let provenance;
  try { provenance = JSON.parse(readFileSync(join(racine, FICHIER_PROVENANCE), "utf8")); }
  catch (e) { erreur("reçu de livraison absent ou illisible dans " + racine); }
  verifierChamps(provenance, String(commitAttendu).trim().toLowerCase());
  const calculee = empreinteArbreGenere(racine);
  if (calculee !== provenance.generatedTreeSha256) erreur("les fichiers générés diffèrent du reçu de livraison");
  return provenance;
}

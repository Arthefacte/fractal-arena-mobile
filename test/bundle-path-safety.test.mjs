import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { resoudreRessourceSri } from "../scripts/sync-web.mjs";

const RACINE = resolve(import.meta.dirname, "..");
const SYNC = join(RACINE, "scripts", "sync-web.mjs");
const ZIP = join(RACINE, "scripts", "zip-bundle.py");
const PYTHON = process.env.PYTHON || "python";

function bacASable() {
  return mkdtempSync(join(tmpdir(), "fractal-arena-bundle-"));
}

function lienOuIgnorer(t, cible, lien, type = "file") {
  try {
    symlinkSync(cible, lien, type);
  } catch (e) {
    if (e.code === "EPERM" || e.code === "EACCES" || e.code === "ENOTSUP") {
      t.skip("les liens symboliques ne sont pas disponibles sur cet hôte");
      return false;
    }
    throw e;
  }
  return true;
}

test("sync-web refuse un lien symbolique de la source", (t) => {
  const bac = bacASable();
  try {
    const web = join(bac, "web");
    const secret = join(bac, "secret.txt");
    mkdirSync(web);
    writeFileSync(secret, "secret de signature");
    if (!lienOuIgnorer(t, secret, join(web, "fuite.txt"))) return;

    const r = spawnSync(process.execPath, [SYNC], {
      env: { ...process.env, FA_WEB_DIR: web },
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /client web contient un lien symbolique : fuite\.txt/);
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

test("sync-web borne les chemins des scripts SRI à www", () => {
  const bac = bacASable();
  try {
    const www = join(bac, "www");
    const script = join(www, "build", "app.js");
    mkdirSync(dirname(script), { recursive: true });
    writeFileSync(script, "console.log('jeu');");
    const racineWww = realpathSync(www);

    for (const src of [
      "../secret.js",
      "%2e%2e/secret.js",
      "/etc/passwd",
      "%2fetc/passwd",
      "C:/secret.js",
      "..\\secret.js",
      "//serveur/secret.js",
      "file:///secret.js",
      "javascript:alert(1)",
      "build/app.js#fragment",
    ]) {
      assert.throws(() => resoudreRessourceSri(racineWww, src), /source SRI locale non sûre/,
        `la source dangereuse doit être refusée : ${src}`);
    }

    assert.equal(resoudreRessourceSri(racineWww, "https://cdn.example/app.js"), null,
      "les scripts HTTPS externes restent hors de la vérification des fichiers locaux");
    assert.deepEqual(resoudreRessourceSri(racineWww, "build/app.js?v=42"), {
      chemin: "build/app.js",
      abs: realpathSync(script),
    }, "un script régulier sous www avec cache-bust doit rester accepté");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

test("sync-web refuse les cibles SRI non régulières", (t) => {
  const bac = bacASable();
  try {
    const www = join(bac, "www");
    const externe = join(bac, "secret.js");
    const dossierExterne = join(bac, "prive");
    mkdirSync(join(www, "build"), { recursive: true });
    mkdirSync(dossierExterne);
    writeFileSync(externe, "secret");
    writeFileSync(join(dossierExterne, "secret.js"), "secret imbriqué");
    const racineWww = realpathSync(www);
    assert.throws(() => resoudreRessourceSri(racineWww, "build"), /fichier non régulier/,
      "un dossier ne doit jamais atteindre la lecture SRI");
    if (!lienOuIgnorer(t, externe, join(www, "build", "lien.js"))) return;
    assert.throws(() => resoudreRessourceSri(racineWww, "build/lien.js"), /lien symbolique interdit/,
      "un lien symbolique ne doit jamais atteindre la lecture SRI");
    if (!lienOuIgnorer(t, dossierExterne, join(www, "prive"), "dir")) return;
    assert.throws(() => resoudreRessourceSri(racineWww, "prive/secret.js"), /sortie de la racine canonique/,
      "un dossier lié hors de www ne doit jamais atteindre la lecture SRI");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

for (const [nom, type] of [["fichier", "file"], ["dossier", "dir"]]) {
  test(`zip-bundle refuse un lien symbolique de ${nom}`, (t) => {
    const bac = bacASable();
    try {
      const source = join(bac, "www");
      const externe = join(bac, type === "dir" ? "prive" : "secret.txt");
      mkdirSync(source);
      if (type === "dir") {
        mkdirSync(externe);
        writeFileSync(join(externe, "cle.txt"), "clé privée");
      } else {
        writeFileSync(externe, "mot de passe");
      }
      if (!lienOuIgnorer(t, externe, join(source, "fuite"), type)) return;

      const archive = join(bac, "bundle.zip");
      const r = spawnSync(PYTHON, [ZIP, source, archive], { encoding: "utf8" });
      assert.notEqual(r.status, 0);
      assert.match(r.stdout + r.stderr, /source non sûre : lien symbolique interdit : fuite/);
      assert.equal(existsSync(archive), false);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
}

test("zip-bundle conserve les fichiers ordinaires imbriqués", () => {
  const bac = bacASable();
  try {
    const source = join(bac, "www");
    const fichier = join(source, "assets", "jeu.txt");
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, "contenu légitime");

    const archive = join(bac, "bundle.zip");
    const r = spawnSync(PYTHON, [ZIP, source, archive], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(existsSync(archive), true);

    const verification = spawnSync(PYTHON, ["-c",
      "import sys, zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.namelist() == ['assets/jeu.txt']; assert z.read('assets/jeu.txt').decode() == 'contenu légitime'",
      archive,
    ], { encoding: "utf8" });
    assert.equal(verification.status, 0, verification.stdout + verification.stderr);
    assert.equal(readFileSync(fichier, "utf8"), "contenu légitime");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

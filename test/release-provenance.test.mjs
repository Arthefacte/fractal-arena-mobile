import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ecrireProvenance,
  materialiserClientWebApprouve,
  verifierProvenance,
} from "../scripts/web-provenance.mjs";

const RACINE = resolve(import.meta.dirname, "..");
const ORIGINE = "https://github.com/Arthefacte/fractal-arena-web.git";

function git(repertoire, ...args) {
  const r = spawnSync("git", args, { cwd: repertoire, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout.trim();
}

function creerDepot(t, origine = ORIGINE) {
  const bac = mkdtempSync(join(tmpdir(), "fractal-arena-provenance-test-"));
  const depot = join(bac, "web");
  mkdirSync(depot);
  t.after(() => rmSync(bac, { recursive: true, force: true }));
  git(depot, "init", "-q");
  git(depot, "config", "user.name", "Test");
  git(depot, "config", "user.email", "test@example.invalid");
  git(depot, "remote", "add", "origin", origine);
  mkdirSync(join(depot, "assets"));
  writeFileSync(join(depot, "index.html"), "client approuvé\n");
  writeFileSync(join(depot, "assets", "jeu.js"), "window.jeu = true;\n");
  git(depot, "add", ".");
  git(depot, "commit", "-qm", "client approuvé");
  return { bac, depot, commit: git(depot, "rev-parse", "HEAD") };
}

test("une livraison exige une sélection explicite", () => {
  assert.throws(() => materialiserClientWebApprouve({}), /FA_WEB_DIR est obligatoire/);
});

test("le dépôt approuvé doit avoir le bon origin", (t) => {
  const fixture = creerDepot(t, "https://github.com/example/fractal-arena-web.git");
  assert.throws(
    () => materialiserClientWebApprouve({ FA_WEB_DIR: fixture.depot, FA_WEB_COMMIT: fixture.commit }),
    /remote origin doit être/,
  );
});

for (const etat of ["suivi modifié", "non suivi"]) {
  test("une livraison refuse un fichier " + etat, (t) => {
    const fixture = creerDepot(t);
    if (etat === "suivi modifié") writeFileSync(join(fixture.depot, "index.html"), "injecté\n");
    else writeFileSync(join(fixture.depot, "injection.js"), "injecté\n");
    assert.throws(
      () => materialiserClientWebApprouve({ FA_WEB_DIR: fixture.depot, FA_WEB_COMMIT: fixture.commit }),
      /fichiers suivis modifiés ou des fichiers non suivis/,
    );
  });
}

test("HEAD doit rester sur le commit approuvé", (t) => {
  const fixture = creerDepot(t);
  writeFileSync(join(fixture.depot, "index.html"), "autre commit\n");
  git(fixture.depot, "add", "index.html");
  git(fixture.depot, "commit", "-qm", "autre commit");
  assert.throws(
    () => materialiserClientWebApprouve({ FA_WEB_DIR: fixture.depot, FA_WEB_COMMIT: fixture.commit }),
    /HEAD .* diffère de FA_WEB_COMMIT/,
  );
});

test("le snapshot et son reçu restent liés aux octets approuvés", (t) => {
  const fixture = creerDepot(t);
  const approuve = materialiserClientWebApprouve({
    FA_WEB_DIR: fixture.depot,
    FA_WEB_COMMIT: fixture.commit,
  });
  try {
    writeFileSync(join(fixture.depot, "index.html"), "mutation concurrente\n");
    assert.equal(readFileSync(join(approuve.repertoire, "index.html"), "utf8"), "client approuvé\n");

    const genere = join(fixture.bac, "www");
    mkdirSync(genere);
    writeFileSync(join(genere, "index.html"), "client transformé\n");
    const recu = ecrireProvenance(genere, approuve.provenance);
    assert.equal(recu.webCommit, fixture.commit);
    assert.equal(verifierProvenance(genere, fixture.commit).webTree, approuve.provenance.webTree);

    writeFileSync(join(genere, "injection.js"), "injecté après génération\n");
    assert.throws(() => verifierProvenance(genere, fixture.commit), /diffèrent du reçu/);
  } finally {
    approuve.nettoyer();
  }
});

test("les deux livraisons partagent le contrôle de provenance", () => {
  const release = readFileSync(join(RACINE, "scripts", "build-release.mjs"), "utf8");
  const bundle = readFileSync(join(RACINE, "scripts", "build-bundle.mjs"), "utf8");
  const gradle = readFileSync(join(RACINE, "android", "app", "build.gradle"), "utf8");
  assert.match(release, /node\(\["scripts\/sync-web\.mjs"\]\)/);
  assert.match(release, /verifierProvenance\(ASSETS_ANDROID\)/);
  assert.match(bundle, /node\(\["scripts\/sync-web\.mjs"\]\)/);
  assert.match(bundle, /webCommit: provenance\.webCommit/);
  assert.match(gradle, /preReleaseBuild.*dependsOn\(verificationProvenanceRelease\)/s);
});

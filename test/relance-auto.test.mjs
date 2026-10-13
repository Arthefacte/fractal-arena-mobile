/* Politique de relance automatique après une mise à jour du jeu.

   Le fondateur ne veut plus d'un deuxième lancement manuel : une fois le paquet
   téléchargé, l'app doit se relancer. Le risque de ce confort est connu — un
   joueur ne doit JAMAIS voir l'app se relancer en pleine partie. Ces tests
   tiennent les trois moments autorisés et le repli, sans quoi la prochaine
   modification tranquille pourrait relancer l'app n'importe quand.

   Le chemin natif lui-même (reload applique le paquet en attente) est exercé par
   scripts/verif-maj.mjs dans un vrai navigateur avec un faux plugin strict, et
   par android/app/src/test/java/ee/forgr/capacitor_updater/UpdateContractTest.java
   pour les classes Java. Ici : la politique, lisible dans la source. */
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const SYNC = lire("scripts/sync-web.mjs");

test("le paquet téléchargé est appliqué tout de suite, après next()", () => {
  assert.match(SYNC, /appliquerMaintenant\(U, String\(d\.version\)\)/,
    "la relance n'est plus déclenchée après next() : le joueur devrait relancer l'app à la main");
  const bloc = SYNC.slice(SYNC.indexOf("return U.next({ id: b.id })"), SYNC.indexOf("return U.next({ id: b.id })") + 400);
  assert.match(bloc, /appliquerMaintenant/, "next() doit être suivi de l'application immédiate");
  assert.ok(!/U\.set\(/.test(SYNC), "set() recharge sans prévenir : c'est reload() que la politique utilise");
});

test("jamais pendant qu'on joue : les trois moments autorisés sont dans la source", () => {
  const i = SYNC.indexOf("function appliquerMaintenant");
  assert.ok(i > 0, "appliquerMaintenant introuvable");
  const bloc = SYNC.slice(i, i + 2600);
  // (a) personne n'a encore joué
  assert.match(bloc, /encoreAuDemarrage/, "condition « encore au démarrage » absente");
  assert.match(bloc, /getElementById\("boot"\)/, "le splash doit compter comme « pas encore joué »");
  assert.match(bloc, /data-screen-label="cinematique-ouverture"/, "la cinématique d'ouverture doit compter comme « pas encore joué »");
  // (b) le joueur ne touche plus à rien
  assert.match(bloc, /dernierGeste/, "l'inactivité du joueur n'est pas suivie");
  assert.match(bloc, /8000/, "le seuil d'inactivité (8 s) a disparu");
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach((t) => {
    assert.ok(bloc.includes(t), `le geste ${t} n'est plus surveillé : un joueur actif pourrait être relancé`);
  });
  // (c) l'app passe en arrière-plan : redémarrage invisible
  assert.match(bloc, /visibilitychange/, "le passage en arrière-plan n'est plus un moment d'application");
  assert.match(bloc, /visibilityState === "hidden"/, "la condition d'arrière-plan a changé de forme");
});

test("l'application ne reste pas suspendue indéfiniment, et prévient le joueur", () => {
  const i = SYNC.indexOf("function appliquerMaintenant");
  const bloc = SYNC.slice(i, i + 2600);
  assert.match(bloc, /600000/, "plafond (10 min) absent : le minuteur pourrait tourner pour rien");
  assert.match(bloc, /s'installera au prochain lancement/, "le repli historique doit rester annoncé si la relance n'a pas lieu");
  assert.match(bloc, /MAJ : redémarrage automatique impossible/,
    "un échec de relance doit laisser une trace en console, jamais un silence");
  assert.match(bloc, /catch/, "un plugin sans reload() doit être rattrapé, pas laissé planter la mise à jour");
});

test("la relance passe par reload(), pas par un rechargement du jeu en cours", () => {
  const i = SYNC.indexOf("function appliquerMaintenant");
  const bloc = SYNC.slice(i, i + 2600);
  assert.match(bloc, /U\.reload\(\)/, "reload() est le seul appel natif qui applique le paquet en attente");
  assert.ok(!/location\.reload\(\)/.test(bloc), "location.reload() ne change PAS de paquet : il rechargerait la version en cours");
});

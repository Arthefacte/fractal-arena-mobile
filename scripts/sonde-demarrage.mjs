/* Sonde de fluidité du DÉMARRAGE (écran d'assemblage + préparation 3D).

   But : mesurer, dans un vrai navigateur, ce que le joueur voit pendant que le
   splash tourne — c'est-à-dire l'écart entre les images réellement rendues, et
   les tâches longues qui bloquent le fil principal PENDANT que l'emblème
   s'assemble. Un jerk sur téléphone ne se prouve pas ici : ce qu'on prouve, c'est
   que le fil principal est bloqué par tranches de N ms pendant l'assemblage, et
   si les images de l'assemblage continuent de défiler pendant ces blocages.

   Usage :
     node scripts/sonde-demarrage.mjs --port 8099 --cpu 4 --out sonde-cpu4.json

   Prérequis : `www/` généré (npm run build:web) servi par un serveur local :
     python -m http.server 8099 --directory www
*/
import { createRequire } from "node:module";
import { writeFileSync, writeFile, mkdirSync } from "node:fs";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

function arg(nom, defaut) {
  const i = process.argv.indexOf("--" + nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
}

const PORT = Number(arg("port", 8099));
const CPU = Number(arg("cpu", 4));
const OUT = arg("out", "sonde-demarrage.json");
const MSG = arg("attendre", "supprime"); // « supprime » = jusqu'au retrait du splash
const CAPTURE = arg("capture", "oui") === "oui";
const IMAGES = arg("images", ""); // répertoire où garder les images réellement affichées
if (IMAGES) mkdirSync(IMAGES, { recursive: true });

const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  // Chromium headless annonce « prefers-reduced-motion: reduce » : sans ça, on
  // mesure le repli (emblème assemblé, immobile) et pas l'animation réelle.
  reducedMotion: "no-preference",
});
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

// Ce qui est RÉELLEMENT affiché : la cadence des images produites par le
// compositeur, pas celle du fil principal. Un rAF bloqué ne dit pas si l'écran
// bouge ; les images d'un screencast, si. C'est cette mesure qui distingue
// « l'animation continue » de « l'animation se fige ».
const t0Node = Date.now();
const trames = [];
cdp.on("Page.screencastFrame", (e) => {
  const t = +Date.now() - t0Node;
  trames.push(t);
  // Les images elles-mêmes : elles servent à prouver, hors de tout fil JS, si la
  // zone de l'emblème CHANGE pendant un blocage du fil principal.
  if (IMAGES) writeFile(`${IMAGES}/n${String(Math.round(t)).padStart(6, "0")}.jpg`, Buffer.from(e.data, "base64"), () => {});
  cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
});
if (CAPTURE) await cdp.send("Page.startScreencast", { format: "jpeg", quality: 35, everyNthFrame: 1 });

// Instrumentation posée AVANT tout script de la page (CDP, donc hors CSP).
await page.addInitScript(() => {
  const S = { t0: performance.now(), frames: [], taches: [], swaps: [], jalons: [], evenements: {} };
  window.__SONDE = S;
  const r = window.requestAnimationFrame.bind(window);
  (function boucle() { S.frames.push(performance.now()); r(boucle); })();
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) S.taches.push({ t: +e.startTime.toFixed(1), d: +e.duration.toFixed(1) });
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) { S.evenements.longtaskIndisponible = String(e && e.message); }

  const noter = (nom) => { S.evenements[nom] = +perfNow().toFixed(1); };
  function perfNow() { return performance.now(); }

  document.addEventListener("DOMContentLoaded", () => {
    // Position réelle de la zone de l'emblème (pour cropper les images affichées).
    setTimeout(() => {
      const w = document.querySelector("#boot .emb-wrap");
      if (w) { const r = w.getBoundingClientRect(); S.rect = { x: r.x, y: r.y, w: r.width, h: r.height }; }
      S.fenetre = { l: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
    }, 1200);
    const emb = document.getElementById("boot-emblem");
    // Preuve directe : la position de la bande dans sa fenêtre, échantillonnée
    // pendant tout le démarrage. Si ces valeurs ne bougent pas, l'animation ne
    // tourne pas — indépendamment de ce que racontent les timers JS.
    S.bande = [];
    const ech = setInterval(() => {
      const i = document.getElementById("boot-emblem");
      if (!i) return;
      const r = i.getBoundingClientRect();
      S.bande.push({ t: +perfNow().toFixed(0), haut: Math.round(r.top), h: Math.round(r.height), pret: i.complete, l: i.naturalWidth });
      if (S.bande.length > 400) clearInterval(ech);
    }, 150);
    if (emb) new MutationObserver((ms) => {
      for (const m of ms) if (m.attributeName === "src") S.swaps.push(+perfNow().toFixed(1));
    }).observe(emb, { attributes: true, attributeFilter: ["src"] });
    const b = document.getElementById("boot");
    if (b) {
      new MutationObserver(() => {
        if (b.style.opacity === "0" && !S.evenements.splashFondu) noter("splashFondu");
      }).observe(b, { attributes: true, attributeFilter: ["style"] });
      if (document.body) new MutationObserver(() => {
        if (!document.getElementById("boot") && !S.evenements.splashRetire) noter("splashRetire");
      }).observe(document.body, { childList: true });
    }
    const root = document.getElementById("root");
    if (root) new MutationObserver(() => {
      if (root.children.length && !S.evenements.reactMonte) noter("reactMonte");
    }).observe(root, { childList: true });
    if (document.body) {
      let observateurCine = null;
      const cine = () => document.querySelector('[data-screen-label="cinematique-ouverture"]');
      const jalon = () => {
        const c = cine();
        if (!c) return;
        if (c.getAttribute("data-cine-ready") === "true" && !S.evenements.cinePrete) noter("cinePrete");
        if (!observateurCine) {
          observateurCine = new MutationObserver(jalon);
          observateurCine.observe(c, { attributes: true, attributeFilter: ["data-cine-ready"] });
        }
      };
      new MutationObserver(jalon).observe(document.body, { childList: true, subtree: true });
      jalon();
    }
    if (window.FA_DIAG && window.FA_DIAG.marque) {
      const m = window.FA_DIAG.marque.bind(window.FA_DIAG);
      window.FA_DIAG.marque = (nom) => { S.jalons.push({ nom, t: +perfNow().toFixed(1) }); try { m(nom); } catch (e) {} };
    }
  });
});

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") erreurs.push("console: " + m.text().slice(0, 200)); });

const depart = Date.now();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 90000 });

// Attendre l'événement demandé, sinon 25 s.
const limite = MSG === "supprime" ? "splashRetire" : MSG;
try {
  await page.waitForFunction(
    (n) => window.__SONDE && window.__SONDE.evenements[n],
    limite,
    { timeout: 25000, polling: 50 },
  );
} catch (e) { /* on mesure quand même ce qu'on a */ }
await page.waitForTimeout(600);

const donnees = await page.evaluate(() => {
  const S = window.__SONDE;
  let gl = null;
  try {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2") || c.getContext("webgl");
    const d = g && g.getExtension("WEBGL_debug_renderer_info");
    gl = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : (g ? "indisponible" : "aucun WebGL");
  } catch (e) { gl = "erreur: " + e.message; }
  return {
    frames: S.frames, taches: S.taches, swaps: S.swaps, jalons: S.jalons,
    evenements: S.evenements, gl,
    duree: performance.now(),
    peintures: performance.getEntriesByType("paint").map((p) => ({ nom: p.name, t: +p.startTime.toFixed(1) })),
    origine: performance.timeOrigin,
    rect: S.rect || null,
    fenetre: S.fenetre || null,
    bande: S.bande || [],
    bootAnimCharge: typeof window.__BOOT_FRAMES !== "undefined",
    nbFramesAnim: (window.__BOOT_FRAMES || []).length,
  };
});
const horlogeNode = Date.now();
if (CAPTURE) await cdp.send("Page.stopScreencast").catch(() => {});
await navigateur.close();

// ---- Réduction ----
function stats(v) {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: v.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) };
}
function ecarts(v) { const o = []; for (let i = 1; i < v.length; i++) o.push(+(v[i] - v[i - 1]).toFixed(1)); return o; }

const finSplash = donnees.evenements.splashRetire || donnees.duree;
const ei = ecarts(donnees.frames.filter((t) => t <= finSplash));
const et = ecarts(donnees.swaps.map((s) => s));
const tas = donnees.taches.filter((t) => t.t <= finSplash);

// ---- Ce qui est affiché (screencast) : recadré sur l'horloge de la page ----
const decalage = horlogeNode - (donnees.origine + donnees.duree); // tempsPage + decalage = tempsNode
const tAff = trames.map((t) => t - decalage).sort((a, b) => a - b);
const dans = tAff.filter((t) => t <= finSplash);
const ea = ecarts(dans);
const blocages = tas.filter((t) => t.d >= 150).map((t) => ({
  blocageMs: t.d, debut: Math.round(t.t),
  imagesPendant: dans.filter((f) => f >= t.t && f <= t.t + t.d).length,
  imagesParSeconde: +(dans.filter((f) => f >= t.t && f <= t.t + t.d).length / (t.d / 1000)).toFixed(1),
}));

const rapport = {
  cpuThrottle: CPU,
  gl: donnees.gl,
  anim: { chargee: donnees.bootAnimCharge, frames: donnees.nbFramesAnim },
  jalons: donnees.evenements,
  premierePeinture: donnees.peintures,
  marquesDiag: donnees.jalons,
  affichage: {
    imagesAffichees: dans.length,
    parSeconde: +(dans.length / (finSplash / 1000)).toFixed(1),
    ecartMs: stats(ea),
    auDessus50: ea.filter((x) => x > 50).length,
    auDessus100: ea.filter((x) => x > 100).length,
    auDessus250: ea.filter((x) => x > 250).length,
    pires: ea.map((d, i) => ({ d, t: dans[i] })).sort((a, b) => b.d - a.d).slice(0, 6)
      .map((x) => `${x.d}ms @${Math.round(x.t)}ms`),
  },
  blocages,
  images: {
    total: ei.length + 1,
    ecartMs: stats(ei),
    auDessus50: ei.filter((x) => x > 50).length,
    auDessus100: ei.filter((x) => x > 100).length,
    auDessus250: ei.filter((x) => x > 250).length,
    pires: ei.map((d, i) => ({ d, t: donnees.frames[i] })).sort((a, b) => b.d - a.d).slice(0, 8)
      .map((x) => `${x.d}ms @${Math.round(x.t)}ms`),
  },
  assemblage: {
    swaps: et.length, ecartMs: stats(et),
    auDessus100: et.filter((x) => x > 100).length,
    auDessus250: et.filter((x) => x > 250).length,
  },
  tachesLongues: {
    total: tas.length,
    auDessus50: tas.filter((t) => t.d > 50).length,
    auDessus100: tas.filter((t) => t.d > 100).length,
    sommeMs: +tas.reduce((a, t) => a + t.d, 0).toFixed(0),
    plusLongues: tas.slice().sort((a, b) => b.d - a.d).slice(0, 8).map((t) => `${t.d}ms @${Math.round(t.t)}ms`),
  },
  erreurs: erreurs.slice(0, 5),
};
writeFileSync(OUT, JSON.stringify({ rapport, brut: donnees, decalage, tramesAffichees: dans.map((t) => Math.round(t)) }, null, 2));
console.log(JSON.stringify(rapport, null, 2));
console.log(`\nHorloge : tempsPage + ${Math.round(decalage)} = tempsNode (nom des images)`);

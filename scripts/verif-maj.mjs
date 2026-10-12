/* Vérifie que l'app PEUT lire la version publiée et déclencher une mise à jour.
   Deux choses à prouver, avec un faux plugin natif et sans toucher à rien :
   1. la requête vers le manifeste n'est pas bloquée par la CSP (c'était le bug :
      vérifié dans le vrai navigateur, pas en lisant le code) ;
   2. quand la version publiée est plus récente que celle du bundle, l'app appelle
      bien download() avec la bonne URL et la bonne version, puis set() — et
      JAMAIS de rétrogradation quand elle est identique ou plus ancienne. */
import { createRequire } from "node:module";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const MANIFESTE = "https://raw.githubusercontent.com/Arthefacte/fractal-arena-mobile/main/app-bundle.json";
const navigateur = await chromium.launch({ headless: true });

async function essai(versionLocale, libelle) {
  const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } });
  const avertissements = [];

  await page.addInitScript(() => {
    window.__maj = { notifie: 0, telechargements: [], applique: [] };
    window.Capacitor = window.Capacitor || {};
    window.Capacitor.Plugins = window.Capacitor.Plugins || {};
    window.Capacitor.Plugins.CapacitorUpdater = {
      notifyAppReady: () => { window.__maj.notifie++; return Promise.resolve({}); },
      download: (o) => { window.__maj.telechargements.push({ url: o.url, version: o.version }); return Promise.resolve({ id: "bundle-factice", version: o.version }); },
      set: (o) => { window.__maj.applique.push(o.id); return Promise.resolve(); },
    };
  });

  // On simule la version embarquée dans le bundle (l'app installée en a une).
  await page.route("**/app-env.json*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ versionWeb: versionLocale }) }));

  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") avertissements.push(m.text().slice(0, 160)); });

  await page.goto("http://localhost:8099/", { waitUntil: "load", timeout: 60000 });

  // Preuve directe de l'état CSP : la page peut-elle joindre le manifeste ?
  const joignable = await page.evaluate(async (url) => {
    try { const r = await fetch(url, { cache: "no-store" }); return "HTTP " + r.status; } catch (e) { return "REFUSÉ : " + e.message; }
  }, MANIFESTE);

  await page.waitForTimeout(9000);
  const resultat = await page.evaluate(() => window.__maj);
  await page.close();
  return { libelle, versionLocale, joignable, ...resultat, avertissements };
}

const recent = await essai("335", "version locale plus ancienne → doit mettre à jour");
const aJour = await essai("999", "version locale plus récente → ne doit RIEN faire");

console.log(JSON.stringify({ recent, aJour }, null, 2));
await navigateur.close();

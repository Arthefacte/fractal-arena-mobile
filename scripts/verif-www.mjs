/* Vérifie que le bundle www/ embarqué dans l'APK démarre réellement,
   dans un vrai Chromium headless, en viewport téléphone.
   Ce qu'on prouve : tous les fichiers servis existent (zéro 404), l'override
   d'API est appliqué, l'app se déclare installée, et l'écran de titre s'affiche.
   Aucun clic : rien n'est créé côté serveur. */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const URL = "http://localhost:8099/";
const rapport = { url: URL, erreurs: [], requetes4xx: [], etat: null, textes: [] };

const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") rapport.erreurs.push("console: " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => rapport.erreurs.push("pageerror: " + String(e.message).slice(0, 300)));
page.on("requestfailed", (r) => rapport.erreurs.push("requête échouée: " + r.url().slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 400) rapport.requetes4xx.push(r.status() + " " + r.url().slice(0, 200)); });

await page.goto(URL, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(10000);

rapport.etat = await page.evaluate(() => ({
  titre: document.title,
  native: window.FA_NATIVE === true,
  api: window.FA_API_URL || null,
  standalone: window.navigator.standalone === true,
  react: typeof window.React === "object",
  reactDOM: typeof window.ReactDOM === "object",
  trois: !!window.FA_ACCOUNT,
  boot: !!document.getElementById("boot"),
  racineEnfants: document.getElementById("root") ? document.getElementById("root").childElementCount : -1,
}));

rapport.textes = await page.evaluate(() => {
  const t = [];
  for (const e of document.querySelectorAll("#root *, #boot *")) {
    if (e.children.length === 0) { const x = (e.textContent || "").trim(); if (x) t.push(x); }
  }
  return Array.from(new Set(t)).slice(0, 25);
});

await page.screenshot({ path: "capture-app-accueil.png", fullPage: false });
await navigateur.close();

writeFileSync("rapport-app.json", JSON.stringify(rapport, null, 2));
console.log(JSON.stringify(rapport, null, 2));

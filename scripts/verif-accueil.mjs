/* Suite du contrôle : passer la cinématique d'ouverture et lire l'écran
   d'accueil. On NE clique PAS sur « Jouer maintenant » : ce bouton CRÉE un
   compte réel en production, et ce contrôle ne doit rien écrire côté serveur. */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const rapport = { erreurs: [], requetes4xx: [], textes: [], capture: null };
const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") rapport.erreurs.push("console: " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => rapport.erreurs.push("pageerror: " + String(e.message).slice(0, 300)));
page.on("response", (r) => { if (r.status() >= 400) rapport.requetes4xx.push(r.status() + " " + r.url().slice(0, 200)); });

await page.goto("http://localhost:8099/", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(9000);

// « Passer » = sortir de la cinématique. Rien d'autre.
const passe = page.locator("text=/^Passer/").first();
if (await passe.count()) { await passe.click({ timeout: 5000 }).catch(() => {}); }
await page.waitForTimeout(6000);

rapport.textes = await page.evaluate(() => {
  const t = [];
  for (const e of document.querySelectorAll("#root *")) {
    if (e.children.length === 0) { const x = (e.textContent || "").trim(); if (x) t.push(x); }
  }
  return Array.from(new Set(t)).slice(0, 40);
});
rapport.boutons = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button")).map((b) => (b.innerText || "").trim().slice(0, 60)).filter(Boolean).slice(0, 20));

rapport.capture = "capture-accueil.png";
await page.screenshot({ path: rapport.capture });
await navigateur.close();

writeFileSync("rapport-accueil.json", JSON.stringify(rapport, null, 2));
console.log(JSON.stringify(rapport, null, 2));

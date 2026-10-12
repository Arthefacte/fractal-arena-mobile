/* Vérifie le RAPPORT D'ÉCHEC de l'app : dans un build de diagnostic, il doit
   s'afficher tout seul et contenir les faits utiles (version de WebView, erreurs,
   état de #root, réponse de l'API). C'est ce que le fondateur lira sur son écran,
   donc on le lit ici d'abord. */
import { createRequire } from "node:module";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } });
await page.goto("http://localhost:8099/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(6000);

const rapport = await page.evaluate(() => {
  const p = document.getElementById("fa-rapport");
  return {
    present: !!p,
    texte: p ? p.innerText : null,
    defile: p ? p.scrollHeight > p.clientHeight : null,
  };
});
console.log("panneau présent :", rapport.present);
console.log("--- texte du panneau ---");
console.log(rapport.texte);
await page.screenshot({ path: "capture-rapport.png", fullPage: false });
await navigateur.close();

/* Vérifie le bouton de liaison et son message dans le bundle de l'app.
   Dans un navigateur de bureau il n'y a PAS de module natif : le clic doit donc
   dire honnêtement « scanner indisponible » plutôt que de ne rien faire. C'est
   exactement le contrat qu'on vérifie ici (le scan caméra lui-même ne se teste
   que sur un téléphone). */
import { createRequire } from "node:module";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } });
await page.goto("http://localhost:8099/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(6000);

const avant = await page.evaluate(() => {
  const b = document.getElementById("fa-lier");
  return { present: !!b, texte: b ? b.innerText : null, lie: !!(window.FA_ACCOUNT && window.FA_ACCOUNT.estAppareilLie()) };
});
console.log("bouton :", JSON.stringify(avant));

if (avant.present) {
  await page.click("#fa-lier");
  await page.waitForTimeout(800);
  const apres = await page.evaluate(() => {
    const m = document.getElementById("fa-message");
    return m ? m.innerText : null;
  });
  console.log("message après clic :", apres);
}

await navigateur.close();

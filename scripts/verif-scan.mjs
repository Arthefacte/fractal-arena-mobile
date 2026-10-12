/* Vérifie le flux de liaison de bout en bout, sans téléphone :
   - un FAUX plugin natif reproduisant le contrat RÉEL (résultats par l'événement
     `barcodesScanned`, pas par la valeur de retour de startScan — c'était le bug) ;
   - un FAUX serveur pour /auth/device-claim : aucun appel réel, aucun compte créé.
   Ce qu'on attend : pas de bouton pendant l'écran d'accueil ; bouton présent dans
   l'arène ; au clic, le scan démarre ; à l'événement, le bon code part au serveur,
   puis le jeton est stocké et l'appareil marqué comme lié. */
import { createRequire } from "node:module";

const require = createRequire("C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json");
const { chromium } = require("playwright-core");

const navigateur = await chromium.launch({ headless: true });
const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } });

await page.addInitScript(() => {
  const abonnes = {};
  window.__scan = { demarrages: 0, arretes: 0 };
  window.Capacitor = window.Capacitor || {};
  window.Capacitor.Plugins = window.Capacitor.Plugins || {};
  window.Capacitor.Plugins.BarcodeScanner = {
    requestPermissions: () => Promise.resolve({ camera: "granted" }),
    addListener: (nom, fn) => {
      (abonnes[nom] = abonnes[nom] || []).push(fn);
      return Promise.resolve({ remove: () => { abonnes[nom] = (abonnes[nom] || []).filter((f) => f !== fn); } });
    },
    startScan: () => { window.__scan.demarrages++; return Promise.resolve(); },
    stopScan: () => { window.__scan.arretes++; return Promise.resolve(); },
  };
  window.__emettreCode = (valeur) => {
    (abonnes["barcodesScanned"] || []).forEach((f) => f({ barcodes: [{ rawValue: valeur, displayValue: valeur, format: "QR_CODE" }] }));
  };
});

let requete = null;
await page.route("**/auth/device-claim", async (route) => {
  requete = { methode: route.request().method(), corps: JSON.parse(route.request().postData() || "{}") };
  await route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ token: "jeton-de-test", wallet: "bc1qtestonly", kind: "generated" }),
  });
});

await page.goto("http://localhost:8099/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(4000);

const pendantAccueil = await page.evaluate(() => ({
  boutonDeLiaison: !!document.getElementById("fa-lier"),
  ecranAccueil: (document.body.innerText || "").includes("APPUYER POUR COMMENCER"),
}));

// On force l'état « joueur entré dans l'arène » : une session existe.
// (C'est le signal qu'utilise le bouton — pas la disparition du splash, qui
// laissait passer le bouton pendant la cinématique d'ouverture.)
await page.evaluate(() => { window.FA_ACCOUNT.writeToken("jeton-de-test", window.FA_ACCOUNT.KIND_GENERATED); });
await page.waitForTimeout(2600);
const apresEntree = await page.evaluate(() => {
  const b = document.getElementById("fa-lier");
  return { bouton: b ? b.innerText : null };
});

// Clic → démarrage du scan (faux plugin) → l'événement porte le contenu du QR.
await page.evaluate(() => { const b = document.getElementById("fa-lier"); if (b) b.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => window.__emettreCode("https://fractalarena.com/#link=ABCD1234EFGH5678"));
await page.waitForTimeout(700);

const apres = await page.evaluate(() => ({
  scan: window.__scan,
  appareilLie: !!(window.FA_ACCOUNT && window.FA_ACCOUNT.estAppareilLie()),
  jeton: !!(window.FA_ACCOUNT && window.FA_ACCOUNT.readToken()),
  message: (document.getElementById("fa-message") || {}).innerText || null,
}));

console.log(JSON.stringify({ pendantAccueil, apresEntree, requete, apres }, null, 2));
await navigateur.close();

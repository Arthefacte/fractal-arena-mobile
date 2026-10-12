#!/usr/bin/env node
/* ============================================================
   Fractal Arena — app Android : génération de www/

   www/ est GÉNÉRÉ depuis le client web réel (../fractal-arena-web, celui
   qui est servi sur fractalarena.com). On ne l'édite jamais à la main :
   une seule source de vérité, le client web.

   Trois différences, et seulement trois, entre le client web et l'app :

    1. API — data.js aiguille vers http://localhost:3000 dès que l'hôte est
       « localhost » ; or Capacitor sert l'app depuis https://localhost.
       Sans override, l'app appellerait un serveur qui n'existe pas sur le
       téléphone. native-env.js est inséré JUSTE APRÈS la balise data.js et
       AVANT les build/*.js, qui capturent window.FA_API_URL à leur
       chargement.

    2. App installée — navigator.standalone est déclaré vrai (native-env.js).
       C'est la définition d'une app native, et c'est ce qui met la session
       en localStorage au lieu de sessionStorage (sinon le joueur est
       déconnecté à chaque fermeture) et supprime la bannière « installer
       l'app » à l'intérieur de l'app.

    3. Installation — le service worker et son enregistrement sont retirés :
       dans l'APK il mettrait les assets locaux en cache et survivrait à une
       mise à jour de l'app, donc servirait une vieille version après une
       MAJ. React vient de l'APK, jamais d'un CDN : le client l'auto-héberge
       depuis la v335, et avant cela l'app le rapatriait elle-même (SRI vérifiée).

   Le script ÉCHOUE si une ancre attendue a disparu, si un fichier requis
   manque, si une SRI ne correspond plus, ou si un fichier exclu est encore
   référencé : une copie silencieusement périmée est pire qu'un build cassé.

   Usage : npm run build:web   (puis npx cap sync android)
   ============================================================ */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Source du client : par défaut le clone voisin, mais on peut pointer un
// WORKTREE pinné sur origin/main (FA_WEB_DIR=...). C'est la règle du studio :
// le clone partagé porte le travail non commité des autres sessions, on ne
// livre jamais depuis lui.
const WEB = process.env.FA_WEB_DIR ? resolve(process.env.FA_WEB_DIR) : resolve(ROOT, "..", "fractal-arena-web");
const WWW = resolve(ROOT, "www");
const API_PROD = "https://fractal-arena-server-production.up.railway.app";

// Tout ce qui n'est pas appelé au runtime du jeu : dev, docs, art de
// référence, protos de chantier, service worker, fichiers d'infra.
const EXCLUS = new Set([
  "node_modules", ".git", ".claude", ".design-sync", ".github",
  "art", "docs", "ds-bundle", "test", "tools", "_bake", "www",
  "CNAME", "Caddyfile", "robots.txt", "sitemap.xml", "llms.txt",
  "sw.js", "sw-register.js", "sw-policy.js",
  "package.json", "package-lock.json", "README.md", ".gitignore",
  "serve_unity.py",
]);

// Le build doit échouer si l'un de ces fichiers disparaît du client web.
const REQUIS = [
  "index.html", "data.js", "i18n.js", "account-ui.js", "device-link-ui.js",
  "styles.css", "mobile.css", "asset-hashes.js",
  "build/app.js", "build/screens.js", "build/components.js",
  "assets/emblem.glb", "assets/favicon.png", "assets/boot-anim.js",
  "vendor/three-0.160.0/three.module.js", "vendor/qrcode-generator/qrcode.js",
];

// React : le client l'a AUTO-HÉBERGÉ depuis la v335 (vendor/react*.js). Tant
// qu'il vivait sur unpkg, l'app le rapatriait dans l'APK (mêmes octets, SRI
// vérifiée) ; on garde ce chemin au cas où le client repasserait au CDN.
const REACT = [
  { url: "https://unpkg.com/react@18.3.1/umd/react.production.min.js", cible: "vendor/react/react.production.min.js" },
  { url: "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", cible: "vendor/react/react-dom.production.min.js" },
];
const REACT_LOCAL = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js"];

// Références qui ne doivent plus exister dans l'app (le service worker).
// On ne cherche pas la CHAÎNE « sw-policy.js » partout : data.js la cite dans un
// commentaire, et un faux positif ici bloque un build sain. Ce qui compte est
// fonctionnel : aucun HTML ne charge le service worker, et rien ne l'enregistre.
const INTERDITS = [
  { motif: /<script[^>]+src="sw-(register|policy)?\.?js[^"]*"/i, ou: "les pages" },
  { motif: /serviceWorker\s*\.\s*register\s*\(/, ou: "les scripts" },
];

const TEXTES = new Set([".html", ".js", ".jsx", ".css", ".webmanifest", ".json"]);
// Fichiers dont on normalise les fins de ligne (le site sert des LF ; un checkout
// Windows peut avoir réécrit le fichier en CRLF — cf. l'étape 2 bis).
const NORMALISABLES = new Set([".html", ".js", ".jsx", ".css", ".json", ".webmanifest", ".txt", ".svg"]);

function echouer(msg) { console.error("\nÉCHEC — " + msg + "\n"); process.exit(1); }
function echapper(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function sha384b64(buf) { return createHash("sha384").update(buf).digest("base64"); }
function sha256b64(buf) { return createHash("sha256").update(buf).digest("base64"); }

function parcourir(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) parcourir(p, out); else out.push(p);
  }
  return out;
}

function taille(dir) {
  let t = 0;
  for (const f of parcourir(dir)) t += statSync(f).size;
  return t;
}

async function main() {
  if (!existsSync(WEB)) echouer("client web introuvable : " + WEB);

  // ---- 1. Copie -------------------------------------------------------
  if (existsSync(WWW)) rmSync(WWW, { recursive: true, force: true });
  mkdirSync(WWW, { recursive: true });
  let copies = 0;
  for (const e of readdirSync(WEB, { withFileTypes: true })) {
    const nom = e.name;
    if (EXCLUS.has(nom)) continue;
    if (nom.startsWith("_")) continue;        // protos HTML de chantier
    if (/\.(md|py)$/i.test(nom)) continue;
    cpSync(join(WEB, nom), join(WWW, nom), { recursive: true });
    copies++;
  }
  if (copies < 20) echouer("copie suspicieusement petite (" + copies + " entrées) : source incomplète ?");

  for (const f of REQUIS) if (!existsSync(join(WWW, f))) echouer("fichier requis absent après copie : " + f);

  // ---- 2. index.html : service worker retiré, React local, override API --
  const fichierIndex = join(WWW, "index.html");
  let html = readFileSync(fichierIndex, "utf8");
  const version = (html.match(/data\.js\?v=(\d+)/) || [])[1] || "";
  if (!version) echouer("version introuvable dans index.html (data.js?v=N) : le cache-bust a changé de forme");

  const regSW = /[ \t]*<script src="sw-register\.js\?v=[^"]*"><\/script>\r?\n/;
  if (!regSW.test(html)) echouer("balise sw-register.js introuvable dans index.html (l'ancre a bougé)");
  html = html.replace(regSW, "");

  // React : rien à faire si le client l'auto-héberge déjà (v335 et après) ;
  // sinon on le rapatrie depuis unpkg, mêmes octets, SRI vérifiée.
  let reactOrigine;
  if (REACT_LOCAL.every((f) => html.includes(f))) {
    for (const f of REACT_LOCAL) if (!existsSync(join(WWW, f))) echouer("le client référence " + f + " mais le fichier est absent de la copie");
    reactOrigine = "auto-hébergé par le client";
  } else {
    for (const { url, cible } of REACT) {
      const re = new RegExp('<script src="' + echapper(url) + '"([^>]*)></script>');
      const m = html.match(re);
      if (!m) echouer("balise React introuvable dans index.html : " + url);
      const integrite = (m[1].match(/integrity="sha384-([^"]+)"/) || [])[1];
      if (!integrite) echouer("SRI absente sur la balise React : " + url);

      const cibleAbs = join(WWW, cible);
      mkdirSync(dirname(cibleAbs), { recursive: true });
      const r = await fetch(url);
      if (!r.ok) echouer("téléchargement React impossible (" + r.status + ") : " + url);
      const buf = Buffer.from(await r.arrayBuffer());
      const calcule = sha384b64(buf);
      if (calcule !== integrite) {
        echouer("SRI NON CONFORME pour " + url + "\n  attendu : sha384-" + integrite + "\n  obtenu  : sha384-" + calcule);
      }
      writeFileSync(cibleAbs, buf);
      html = html.replace(re, '<script src="' + cible + '"' + m[1] + "></script>");
    }
    reactOrigine = "rapatrié d'unpkg (SRI vérifiée)";
  }

  const ancreData = /<script src="data\.js\?v=[^"]*"><\/script>/;
  if (!ancreData.test(html)) echouer("balise data.js introuvable : l'ancre de l'override API a bougé");
  html = html.replace(ancreData, (m) => m + '\r\n  <script src="native-env.js"></script>');

  writeFileSync(fichierIndex, html, "utf8");

  // ---- 3. native-env.js + app-env.json --------------------------------
  // Le rapport d'échec : si le jeu ne démarre pas, l'écran doit le DIRE au lieu
  // de laisser un splash qui tourne indéfiniment. Un joueur ne peut pas ouvrir
  // une console : le seul diagnostic possible est celui qu'on affiche.
  // Écrit en ES5 strict (var, aucune flèche, aucun gabarit) : il doit tourner
  // même sur un WebView ancien, c'est justement le cas qu'il doit décrire.
  const diagForce = process.env.FA_APP_DIAG === "1";
  writeFileSync(join(WWW, "native-env.js"), `/* ============================================================
   Fractal Arena — app Android : environnement natif.
   GÉNÉRÉ par scripts/sync-web.mjs (dépôt fractal-arena-mobile). Ne pas
   éditer ici : modifier le générateur et relancer \`npm run build:web\`.

   1. API — data.js vise http://localhost:3000 dès que l'hôte est
      « localhost », et Capacitor sert l'app depuis https://localhost.
      Sans cette ligne, l'app appellerait un serveur absent du téléphone.

   2. App installée — navigator.standalone est la vérité pour une app
      native. C'est ce qui met la session en localStorage (sinon
      sessionStorage, effacé à la fermeture : joueur déconnecté à chaque
      fois) et supprime la bannière « installer l'app » dans l'app.

   3. Rapport d'échec — si le jeu ne monte pas (ou lève une erreur), un
      panneau affiche CE QUE le WebView a dit : version, erreur, fichier
      et ligne, état de #root, réponse de l'API. Sans lui, un WebView trop
      ancien ne produit qu'un splash infini, indiagnosticable à distance.
   ============================================================ */
(function () {
  window.FA_NATIVE = true;
  window.FA_NATIVE_PLATFORM = "android";
  window.FA_API_URL = ${JSON.stringify(API_PROD)};
  window.FA_APP_DIAG = ${diagForce ? "true" : "false"};
  try {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
  } catch (e) { /* navigateur qui refuse : la session retombe en sessionStorage */ }

  var ERREURS = [];
  function noter(txt) { if (ERREURS.length < 12) ERREURS.push(txt); }
  window.addEventListener("error", function (e) {
    var cible = e.target && e.target.tagName ? " (" + e.target.tagName + " " + (e.target.src || e.target.href || "") + ")" : "";
    noter("ERREUR : " + (e.message || "?") + cible + "  [" + (e.filename || "?").split("/").pop() + ":" + (e.lineno || 0) + "]");
    // On n'AFFICHE que sur une vraie exception JS : un asset qui ne charge pas
    // (image, son) ne doit pas couvrir le jeu d'un rapport d'erreur.
    if (e.message) montrer();
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    noter("PROMESSE REJETEE : " + ((e.reason && (e.reason.message || e.reason)) || "?"));
    montrer();
  });

  function versionWebView() {
    var m = /Chrome\\/([0-9]+)/.exec(navigator.userAgent || "");
    return m ? m[1] : "inconnue";
  }

  var panneau = null;
  function montrer() {
    if (panneau) return;
    panneau = document.createElement("div");
    panneau.id = "fa-rapport";
    panneau.style.cssText = "position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#05070f;"
      + "color:#EAF1FF;font:12px/1.5 monospace;padding:14px;white-space:pre-wrap;word-break:break-word";
    var t = "FRACTAL ARENA — le jeu ne démarre pas\\n"
      + "Cette app envoie ce rapport au studio si tu le copies.\\n\\n"
      + "APP         : client v" + (window.FA_ASSET_V || "?") + ", app Android"
      + ${JSON.stringify(diagForce ? ' (build de diagnostic)' : "")} + "\\n"
      + "WEBVIEW     : Chrome " + versionWebView() + "\\n"
      + "USER-AGENT  : " + (navigator.userAgent || "?") + "\\n"
      + "STANDALONE  : " + (navigator.standalone === true) + "\\n"
      + "API CIBLEE  : " + window.FA_API_URL + "\\n"
      + "REACT       : " + (typeof window.React) + " / ReactDOM " + (typeof window.ReactDOM) + "\\n"
      + "API DU JEU  : " + (typeof window.FA_ACCOUNT) + "\\n"
      + "#ROOT       : " + (document.getElementById("root") ? document.getElementById("root").children.length + " enfant(s)" : "absent") + "\\n"
      + "URL         : " + location.href + "\\n\\n"
      + (ERREURS.length ? ERREURS.join("\\n") : "aucune erreur JS captée");
    var bloc = document.createElement("div");
    bloc.textContent = t;
    var copier = document.createElement("button");
    copier.textContent = "COPIER CE RAPPORT";
    copier.style.cssText = "display:block;margin:0 0 12px;padding:12px 16px;background:#00F0FF;color:#05070f;"
      + "border:0;border-radius:8px;font:bold 13px system-ui";
    copier.onclick = function () {
      var zone = document.createElement("textarea");
      zone.value = t; document.body.appendChild(zone); zone.select();
      try { document.execCommand("copy"); copier.textContent = "COPIÉ"; } catch (e) { copier.textContent = "SÉLECTIONNE LE TEXTE CI-DESSOUS"; }
      document.body.removeChild(zone);
    };
    panneau.appendChild(copier);
    panneau.appendChild(bloc);
    document.body.appendChild(panneau);

    // Réponse réelle de l'API depuis CE téléphone : réseau, CORS et serveur en
    // un seul chiffre. Une requête qui échoue ici explique bien des blocages.
    fetch(window.FA_API_URL + "/stats", { cache: "no-store" })
      .then(function (r) { bloc.textContent += "\\n\\nAPI /stats  : HTTP " + r.status; })
      .catch(function (e) { bloc.textContent += "\\n\\nAPI /stats  : INJOIGNABLE — " + e.message; });
  }

  // Le jeu a 8 s pour montrer quelque chose ; sinon on affiche le rapport.
  // (Le splash reste à l'écran tant que React n'a pas monté : c'est ce délai
  // qui transforme un « chargement infini » en informations exploitables.)
  if (window.FA_APP_DIAG === true) {
    setTimeout(montrer, 1000);
  } else {
    setTimeout(function () {
      var r = document.getElementById("root");
      if (!r || r.children.length === 0) { noter("Le jeu n'a rien affiché en 8 s (React n'a pas monté)"); montrer(); }
    }, 8000);
  }

  /* ============================================================
     LIAISON D'APPAREIL — scanner le QR du PC.

     Le PC (session authentifiée) demande un code à /auth/device-link et
     l'affiche en QR ; ce téléphone le réclame à /auth/device-claim et devient
     une session du MÊME compte. Dans un navigateur, le QR se scanne avec
     l'appareil photo du système, qui ouvre le lien entrant. Une app native n'a
     AUCUN moyen de recevoir ce lien : elle doit donc scanner elle-même — d'où
     la caméra et son autorisation (demandée par le plugin ML Kit, jamais en
     silence).
     ============================================================ */
  function message(txt, couleur) {
    var m = document.getElementById("fa-message");
    if (!m) {
      m = document.createElement("div");
      m.id = "fa-message";
      m.style.cssText = "position:fixed;left:12px;right:12px;bottom:74px;z-index:2147483000;"
        + "padding:11px 14px;border-radius:10px;background:rgba(5,7,15,.94);border:1px solid rgba(0,240,255,.35);"
        + "color:#EAF1FF;font:13px/1.45 system-ui;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.55)";
      document.body.appendChild(m);
    }
    m.style.borderColor = couleur || "rgba(0,240,255,.35)";
    m.textContent = txt;
    m.style.display = "block";
  }

  function codeDepuis(valeur) {
    var DL = window.FA_DEVICE_LINK;
    if (!DL) return null;
    // Le QR porte l'URL de liaison (origin + "/#link=" + CODE) ; codeFromInput
    // tolère aussi un code recopié. Le pont openDapp (base64) est accepté en
    // secours : un QR plus ancien peut avoir cette forme.
    var code = DL.codeFromInput(valeur);
    if (code) return code;
    var m = /[?&]data=([^&]+)/.exec(valeur || "");
    if (m) {
      try { code = DL.codeFromInput(JSON.parse(atob(decodeURIComponent(m[1])))[0]); } catch (e) { /* pas un lien openDapp */ }
    }
    return code;
  }

  function reclamer(valeur) {
    var ACC = window.FA_ACCOUNT, DL = window.FA_DEVICE_LINK;
    var code = codeDepuis(valeur);
    if (!ACC || !DL) { message("Le jeu n'est pas encore chargé — réessaie dans un instant.", "#F7931A"); return; }
    if (!code) { message("Ce QR n'est pas un code de liaison Fractal Arena.", "#F7931A"); return; }
    message("Liaison en cours…");
    fetch(window.FA_API_URL + "/auth/device-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code }),
    }).then(function (r) {
      if (r.status === 400 || r.status === 401) throw new Error("Code invalide, expiré ou déjà utilisé. Redemande un QR sur ton ordinateur.");
      if (r.status === 429) throw new Error("Trop de tentatives — patiente une minute.");
      if (!r.ok) throw new Error("Le serveur n'a pas pu répondre (HTTP " + r.status + "). Réessaie.");
      return r.json();
    }).then(function (d) {
      if (!d || !d.token || !d.wallet) throw new Error("Réponse inattendue du serveur.");
      // L'ORDRE compte : le marqueur de liaison décide du stockage du jeton
      // (localStorage) — écrit après le jeton, il serait perdu à la fermeture.
      ACC.markDeviceLinked();
      ACC.writeToken(d.token, d.kind === "generated" ? ACC.KIND_GENERATED : ACC.KIND_UNISAT);
      message("Compte lié ✓ Ouverture…", "#23E27A");
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) { message(e.message || String(e), "#F7931A"); });
  }

  function scanner() {
    var P = (window.Capacitor && window.Capacitor.Plugins) || {};
    var BS = P.BarcodeScanner;
    if (!BS) { message("Scanner indisponible dans cette app — installe la dernière version téléchargée sur arthefacte.com.", "#F7931A"); return; }
    message("Demande d'accès à l'appareil photo…");
    var permis = BS.requestPermissions ? BS.requestPermissions({ permissions: ["camera"] }) : Promise.resolve({ camera: "granted" });
    Promise.resolve(permis).then(function (p) {
      var etat = p && p.camera ? p.camera : "granted";
      if (etat !== "granted" && etat !== "limited") {
        message("Accès à l'appareil photo refusé. Autorise la caméra pour Fractal Arena dans les réglages Android, puis réessaie.", "#F7931A");
        return null;
      }
      return BS.startScan({ formats: ["QR_CODE"] }).then(function (res) {
        var b = res && res.barcodes && res.barcodes.length ? res.barcodes[0] : null;
        var valeur = b ? (b.rawValue || b.displayValue || "") : "";
        if (!valeur) { message("Aucun QR lu. Réessaie en cadrant le code affiché sur ton ordinateur.", "#F7931A"); return; }
        reclamer(valeur);
      });
    }).catch(function (e) { message("Scan impossible : " + ((e && e.message) || e), "#F7931A"); });
  }

  function boutonLiaison() {
    // Rien à proposer sur un appareil déjà lié, ni dans un build de diagnostic.
    if (window.FA_APP_DIAG === true) return;
    if (!window.FA_ACCOUNT || !window.FA_DEVICE_LINK) return;
    if (window.FA_ACCOUNT.estAppareilLie()) return;
    if (document.getElementById("fa-lier")) return;
    var b = document.createElement("button");
    b.id = "fa-lier";
    b.textContent = "📷 Lier mon compte (QR du PC)";
    b.onclick = scanner;
    b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:2147482999;"
      + "padding:10px 15px;border-radius:999px;border:1px solid rgba(0,240,255,.45);background:rgba(5,7,15,.9);"
      + "color:#00F0FF;font:600 12px system-ui;box-shadow:0 6px 22px rgba(0,0,0,.5)";
    document.body.appendChild(b);
  }
  // Après le montage du jeu (sinon le bouton serait retiré avec le splash), et
  // seulement si l'appareil n'est pas déjà lié à un compte.
  setTimeout(function () { try { boutonLiaison(); } catch (e) { /* purement décoratif */ } }, 4000);
})();
`, "utf8");

  writeFileSync(join(WWW, "app-env.json"), JSON.stringify({
    versionWeb: version,
    api: API_PROD,
    genere: new Date().toISOString(),
  }, null, 2) + "\n", "utf8");

  // ---- 3 bis. Version de l'app = version du client ---------------------
  // Une seule vérité pour le support : la fiche d'app et « à propos » doivent
  // pouvoir dire QUELLE version du jeu tourne dans l'app.
  const gradle = join(ROOT, "android", "app", "build.gradle");
  if (existsSync(gradle)) {
    let g = readFileSync(gradle, "utf8");
    if (!/versionCode \d+/.test(g) || !/versionName "[^"]*"/.test(g)) {
      echouer("versionCode/versionName introuvables dans android/app/build.gradle");
    }
    const neuf = g
      .replace(/versionCode \d+/, "versionCode " + version)
      .replace(/versionName "[^"]*"/, 'versionName "1.0 (client v' + version + ')"');
    if (neuf !== g) writeFileSync(gradle, neuf, "utf8");
  }

  // ---- 3 ter. Conformité octet pour octet avec le site ------------------
  // Le site sert des fins de ligne LF ; un checkout Windows peut réécrire les
  // fichiers en CRLF. Ce n'est PAS cosmétique : les scripts portent une empreinte
  // SRI, et la CSP autorise un script en ligne par son sha256. Avec d'autres
  // octets, le navigateur REFUSE le fichier — et le jeu ne monte jamais.
  // Vécu le 12/10/2026 : React bloqué par sa propre intégrité dans l'APK
  // publiée, splash infini sur le téléphone du fondateur.
  const normalises = [];
  for (const f of parcourir(WWW)) {
    if (!NORMALISABLES.has(f.slice(f.lastIndexOf(".")))) continue;
    const buf = readFileSync(f);
    if (buf.indexOf(13) === -1) continue;
    writeFileSync(f, buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    normalises.push(relative(WWW, f));
  }
  if (normalises.length) console.log("  fins de ligne normalisées en LF : " + normalises.length + " fichier(s)");

  const htmlFinal = readFileSync(fichierIndex, "utf8");
  for (const balise of htmlFinal.match(/<script[^>]*>/g) || []) {
    const src = (balise.match(/src="([^"]+)"/) || [])[1];
    const integ = (balise.match(/integrity="sha384-([^"]+)"/) || [])[1];
    if (!src || !integ || /^https?:/.test(src)) continue;
    const chemin = src.split("?")[0];
    const abs = join(WWW, chemin);
    if (!existsSync(abs)) echouer("ressource SRI absente de la copie : " + chemin);
    const h = sha384b64(readFileSync(abs));
    if (h !== integ) {
      echouer("SRI NON CONFORME — l'APK n'embarquerait pas les octets du site :\n"
        + "  " + chemin + "\n  attendu sha384-" + integ + "\n  obtenu  sha384-" + h);
    }
  }

  const csp = (htmlFinal.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
  for (const [, h] of csp.matchAll(/'sha256-([^']+)'/g)) {
    const enLigne = [...htmlFinal.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (!enLigne.some((s) => sha256b64(Buffer.from(s, "utf8")) === h)) {
      echouer("hash CSP sha256-" + h + " ne correspond à aucun script en ligne de index.html : le navigateur le bloquera");
    }
  }

  // ---- 4. Vérifications ----------------------------------------------
  const servis = parcourir(WWW).filter((f) => TEXTES.has(f.slice(f.lastIndexOf("."))));
  for (const f of servis) {
    const t = readFileSync(f, "utf8");
    for (const { motif, ou } of INTERDITS) {
      if (motif.test(t)) echouer("référence interdite (" + ou + ") dans " + relative(WWW, f) + " : " + motif);
    }
  }
  if (!/native-env\.js/.test(readFileSync(join(WWW, "index.html"), "utf8"))) echouer("native-env.js n'a pas été inséré");
  if (/unpkg\.com\/react/.test(readFileSync(join(WWW, "index.html"), "utf8"))) echouer("React pointe encore vers unpkg");

  const mo = (taille(WWW) / 1048576).toFixed(1);
  console.log("www/ généré depuis " + WEB);
  console.log("  client web v" + version + " → " + mo + " Mo, " + parcourir(WWW).length + " fichiers");
  console.log("  API    : " + API_PROD);
  console.log("  React  : " + reactOrigine);
  console.log("  écarts : override API + navigator.standalone, service worker retiré");
}

main().catch((e) => echouer(e.message));

# Packaging Android via Capacitor — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un APK debug installable de Fractal Arena en emballant l'app web existante dans un webview Capacitor (Android uniquement).

**Architecture:** On conserve l'app web telle quelle (React + Babel standalone transpilés au runtime). On vendorise React/ReactDOM/Babel en local pour supprimer la dépendance au CDN, on génère un dossier `www/` via un script de copie, puis on l'emballe avec Capacitor et on build un APK debug avec Gradle.

**Tech Stack:** Capacitor 6, Node 24, JDK 17 (Microsoft OpenJDK), Android SDK cmdline-tools (API 34, build-tools 34.0.0), Gradle wrapper.

---

## Notes d'environnement

- Répertoire de travail : `C:\Users\PC\Documents\FA Mobile`
- Shell : PowerShell (commandes données en PowerShell ; `gradlew.bat` sous Windows).
- Versions actuellement référencées dans `index.html` : React 18.3.1, ReactDOM 18.3.1, `@babel/standalone` 7.29.0 — on vendorise les variantes **production**.
- Rien n'est installé côté build Android (ni JDK, ni SDK) : les tâches 4-5 installent l'environnement.

## Structure des fichiers

- Créer : `vendor/react.production.min.js`, `vendor/react-dom.production.min.js`, `vendor/babel.min.js`
- Créer : `package.json`, `capacitor.config.json`, `scripts/copy-web.mjs`, `.gitignore`
- Modifier : `index.html` (scripts → `./vendor/`, viewport, init status bar)
- Généré (non commité) : `www/`, `node_modules/`
- Généré par Capacitor : `android/` (Modifier ensuite `android/app/src/main/AndroidManifest.xml`)

---

### Task 1 : Vendoriser React/ReactDOM/Babel en local

**Files:**
- Create: `vendor/react.production.min.js`
- Create: `vendor/react-dom.production.min.js`
- Create: `vendor/babel.min.js`

- [ ] **Step 1: Télécharger les 3 libs dans `vendor/`**

```powershell
New-Item -ItemType Directory -Force "vendor" | Out-Null
Invoke-WebRequest "https://unpkg.com/react@18.3.1/umd/react.production.min.js" -OutFile "vendor/react.production.min.js"
Invoke-WebRequest "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" -OutFile "vendor/react-dom.production.min.js"
Invoke-WebRequest "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" -OutFile "vendor/babel.min.js"
```

- [ ] **Step 2: Vérifier que les fichiers existent et ne sont pas vides**

Run:
```powershell
Get-ChildItem vendor | Select-Object Name, Length
```
Expected: trois fichiers, chacun avec `Length` > 0 (babel.min.js fait plusieurs centaines de Ko).

- [ ] **Step 3: Commit**

```powershell
git add vendor
git commit -m "feat: vendorise react/react-dom/babel en local"
```

---

### Task 2 : Adapter `index.html` (vendor local + viewport)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remplacer les 3 balises script CDN par les versions locales**

Ancien (lignes ~37-39) :
```html
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
```

Nouveau :
```html
  <script src="./vendor/react.production.min.js"></script>
  <script src="./vendor/react-dom.production.min.js"></script>
  <script src="./vendor/babel.min.js"></script>
```

- [ ] **Step 2: Ajouter `viewport-fit=cover` au meta viewport**

Ancien (ligne ~6) :
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
Nouveau :
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 3: Vérifier qu'il ne reste aucune référence à unpkg**

Run:
```powershell
Select-String -Path index.html -Pattern "unpkg"
```
Expected: aucune sortie (plus aucune référence CDN).

- [ ] **Step 4: Commit**

```powershell
git add index.html
git commit -m "feat: charge react/babel depuis vendor local + viewport-fit cover"
```

---

### Task 3 : Script de copie web + config Capacitor + gitignore

**Files:**
- Create: `scripts/copy-web.mjs`
- Create: `package.json`
- Create: `capacitor.config.json`
- Create: `.gitignore`

- [ ] **Step 1: Créer `scripts/copy-web.mjs`**

```javascript
// Copie le build web (sources + vendor) vers www/ pour Capacitor.
import { existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const www = resolve(root, "www");

const FILES = [
  "index.html",
  "styles.css",
  "mobile.css",
  "data.js",
  "i18n.js",
  "engine.js",
  "components.jsx",
  "arena.jsx",
  "screens.jsx",
  "app.jsx",
];
const DIRS = ["assets", "vendor"];

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const f of FILES) {
  const src = resolve(root, f);
  if (!existsSync(src)) throw new Error(`Fichier source manquant: ${f}`);
  cpSync(src, resolve(www, f));
}
for (const d of DIRS) {
  const src = resolve(root, d);
  if (!existsSync(src)) throw new Error(`Dossier source manquant: ${d}`);
  cpSync(src, resolve(www, d), { recursive: true });
}

console.log("www/ généré.");
```

- [ ] **Step 2: Créer `package.json`**

```json
{
  "name": "fractal-arena-mobile",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build:web": "node scripts/copy-web.mjs",
    "sync": "npm run build:web && cap sync"
  },
  "dependencies": {
    "@capacitor/android": "^6.0.0",
    "@capacitor/core": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.0.0"
  }
}
```

- [ ] **Step 3: Créer `capacitor.config.json`**

```json
{
  "appId": "com.fractalarena.app",
  "appName": "Fractal Arena",
  "webDir": "www"
}
```

- [ ] **Step 4: Créer `.gitignore`**

```gitignore
node_modules/
www/
```

- [ ] **Step 5: Installer les dépendances et générer `www/`**

Run:
```powershell
npm install
npm run build:web
```
Expected: `npm install` se termine sans erreur ; `npm run build:web` affiche `www/ généré.`

- [ ] **Step 6: Vérifier le contenu de `www/`**

Run:
```powershell
Test-Path www/index.html, www/vendor/babel.min.js, www/assets/LOGO.png, www/app.jsx
```
Expected: `True` pour les quatre chemins.

- [ ] **Step 7: Commit**

```powershell
git add scripts/copy-web.mjs package.json package-lock.json capacitor.config.json .gitignore
git commit -m "feat: config capacitor + script de build web + gitignore"
```

---

### Task 4 : Installer le JDK 17

**Files:** (aucun — environnement)

- [ ] **Step 1: Installer Microsoft OpenJDK 17 via winget**

```powershell
winget install --id Microsoft.OpenJDK.17 -e --accept-source-agreements --accept-package-agreements
```
Expected: installation réussie (ou « déjà installé »).

- [ ] **Step 2: Localiser et exporter `JAVA_HOME` pour la session**

```powershell
$jdk = Get-ChildItem "C:\Program Files\Microsoft" -Directory | Where-Object Name -like "jdk-17*" | Select-Object -First 1
$env:JAVA_HOME = $jdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Write-Output "JAVA_HOME=$env:JAVA_HOME"
```
Expected: `JAVA_HOME` pointe vers un dossier `jdk-17...`.

- [ ] **Step 3: Vérifier la version de Java**

Run:
```powershell
java -version
```
Expected: sortie mentionnant `openjdk version "17`.

> Pas de commit (changement d'environnement uniquement). Conserver `JAVA_HOME` pour les tâches suivantes (les commandes le re-résolvent au besoin).

---

### Task 5 : Installer l'Android SDK (cmdline-tools + packages)

**Files:** (aucun — environnement)

- [ ] **Step 1: Télécharger et extraire les command-line tools**

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
$zip = "$env:TEMP\cmdline-tools.zip"
Invoke-WebRequest "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zip
Expand-Archive $zip -DestinationPath "$sdk\cmdline-tools" -Force
# Le zip extrait un dossier "cmdline-tools" ; sdkmanager attend ".../cmdline-tools/latest"
if (Test-Path "$sdk\cmdline-tools\cmdline-tools") { Rename-Item "$sdk\cmdline-tools\cmdline-tools" "latest" }
Write-Output "SDK dir: $sdk"
```
Expected: `$sdk\cmdline-tools\latest\bin\sdkmanager.bat` existe.

> Si l'URL renvoie 404, récupérer le lien « Command line tools only » (Windows) sur https://developer.android.com/studio#command-line-tools-only et adapter le nom du zip.

- [ ] **Step 2: Exporter les variables Android pour la session**

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

- [ ] **Step 3: Accepter les licences SDK**

```powershell
cmd /c "echo y| sdkmanager --licenses"
```
Expected: les licences sont acceptées (plusieurs « Accept? (y/N) » validés). Relancer si besoin jusqu'à « All SDK package licenses accepted. »

- [ ] **Step 4: Installer platform-tools, plateforme et build-tools**

```powershell
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```
Expected: `done` / installation des trois packages sans erreur.

- [ ] **Step 5: Vérifier l'installation**

Run:
```powershell
Test-Path "$env:ANDROID_HOME\platforms\android-34", "$env:ANDROID_HOME\build-tools\34.0.0", "$env:ANDROID_HOME\platform-tools\adb.exe"
```
Expected: `True` pour les trois chemins.

> Pas de commit (environnement uniquement).

---

### Task 6 : Ajouter la plateforme Android et synchroniser

**Files:**
- Créé par Capacitor : `android/`

- [ ] **Step 1: Ajouter Android et synchroniser**

S'assurer que `JAVA_HOME` et `ANDROID_HOME` sont définis dans la session (cf. Tasks 4-5), puis :
```powershell
npm run build:web
npx cap add android
npx cap sync android
```
Expected: `cap add android` crée le dossier `android/` ; `cap sync` se termine par `Sync finished`.

- [ ] **Step 2: Vérifier que le projet Android et le webDir sont en place**

Run:
```powershell
Test-Path android/gradlew.bat, android/app/src/main/assets/public/index.html
```
Expected: `True` pour les deux (le `index.html` copié dans les assets natifs).

- [ ] **Step 3: Commit**

```powershell
git add android
git commit -m "feat: ajoute la plateforme android capacitor"
```

---

### Task 7 : Adaptations natives (portrait + status bar)

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `index.html`

- [ ] **Step 1: Verrouiller l'orientation portrait dans le manifest**

Dans `android/app/src/main/AndroidManifest.xml`, sur la balise `<activity ... android:name=".MainActivity" ...>`, ajouter l'attribut `android:screenOrientation="portrait"`.

Exemple (ajouter l'attribut à l'activité existante) :
```xml
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:screenOrientation="portrait"
            android:exported="true">
```

- [ ] **Step 2: Initialiser le style de status bar dans `index.html`**

Ajouter ce bloc juste avant `</body>` dans `index.html` :
```html
  <script>
    // Status bar sombre (texte clair) cohérente avec le fond #05070f
    (function () {
      function applyStatusBar() {
        try {
          var sb = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
          if (sb) sb.setStyle({ style: 'DARK' });
        } catch (e) {}
      }
      document.addEventListener('deviceready', applyStatusBar);
      window.addEventListener('load', applyStatusBar);
    })();
  </script>
```

- [ ] **Step 3: Resynchroniser pour propager `index.html` et le plugin**

Run:
```powershell
npm run build:web
npx cap sync android
```
Expected: `Sync finished` ; le plugin `@capacitor/status-bar` est listé dans la sortie.

- [ ] **Step 4: Vérifier la propagation**

Run:
```powershell
Select-String -Path android/app/src/main/assets/public/index.html -Pattern "setStyle"
Select-String -Path android/app/src/main/AndroidManifest.xml -Pattern "screenOrientation"
```
Expected: une correspondance pour chaque commande.

- [ ] **Step 5: Commit**

```powershell
git add index.html android/app/src/main/AndroidManifest.xml
git commit -m "feat: portrait lock + status bar sombre"
```

---

### Task 8 : Builder l'APK debug

**Files:** (aucun — build)

- [ ] **Step 1: Lancer le build Gradle**

S'assurer que `JAVA_HOME` est défini (cf. Task 4), puis :
```powershell
cd android
.\gradlew.bat assembleDebug
cd ..
```
Expected: `BUILD SUCCESSFUL`.

> En cas d'échec « SDK location not found », créer `android/local.properties` avec `sdk.dir=C\:\\Users\\PC\\AppData\\Local\\Android\\Sdk` puis relancer.

- [ ] **Step 2: Vérifier que l'APK existe**

Run:
```powershell
Get-ChildItem android/app/build/outputs/apk/debug/app-debug.apk | Select-Object FullName, Length
```
Expected: le fichier `app-debug.apk` existe avec `Length` > 0.

- [ ] **Step 3: (Validation utilisateur) Installer sur l'appareil**

Brancher le téléphone (débogage USB activé) puis :
```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Expected: `Success`. À défaut d'`adb`/appareil, copier le `.apk` sur le téléphone et l'installer manuellement.
Validation finale : l'app se lance en portrait et le jeu est jouable.

---

## Self-Review (effectuée)

- **Couverture spec :** vendoring (T1-T2), viewport-fit (T2), script copy-web + config + gitignore (T3), JDK (T4), Android SDK (T5), cap add/sync (T6), portrait + status bar (T7), build APK + install (T8). Tous les points de la spec sont couverts.
- **Placeholders :** aucun TODO/TBD ; tout le code et toutes les commandes sont fournis.
- **Cohérence :** `webDir=www` cohérent entre `capacitor.config.json` (T3) et le script `copy-web.mjs` (T3) ; appId `com.fractalarena.app` cohérent avec la spec ; versions Capacitor 6 alignées entre `package.json` (T3) et les dépendances.
- **Hors périmètre confirmé :** iOS, bundling .jsx, release signée, splash/icônes — non inclus, conformément à la spec.

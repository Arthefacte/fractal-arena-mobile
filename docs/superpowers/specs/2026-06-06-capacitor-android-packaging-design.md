# Spec — Emballer Fractal Arena (web) en app Android via Capacitor

Date : 2026-06-06
Statut : approuvé (design)

## Contexte

`FA Mobile/` est une app web React **sans build step** : `index.html` charge React,
ReactDOM et `@babel/standalone` depuis le CDN unpkg, puis transpile les fichiers `.jsx`
dans le navigateur (`<script type="text/babel" src="...">`). La logique de jeu vit dans
`data.js`, `i18n.js`, `engine.js` et les `.jsx` (`components`, `arena`, `screens`, `app`).
Cette version est **autonome** : aucun appel réseau/backend, la couche on-chain/économie
est simulée via `localStorage`.

Un guide existant (`design_handoff_fractal_arena/MOBILE_NATIVE.md`) décrit déjà l'approche
Capacitor ; cette spec en est la mise en œuvre concrète et ciblée.

## Objectif

Produire un **APK debug installable** sur un téléphone Android, qui charge l'app web
actuelle dans un webview Capacitor, **sans réécrire la logique du jeu**.

### Hors périmètre
- iOS (machine Windows ; nécessiterait un Mac ultérieurement).
- Pré-compilation/bundling des `.jsx` (on conserve Babel standalone au runtime).
- Build de release signé (keystore/AAB) et fiche Google Play.
- Splash screen et icônes personnalisés (icône Capacitor par défaut acceptée pour le test).
- Intégration blockchain/wallet réelle (reste simulée).

## Décisions (issues du brainstorming)

| Sujet | Décision |
|-------|----------|
| Plateforme | Android uniquement |
| Transpilation `.jsx` | Conserver Babel standalone (pas de bundler) |
| Dépendance CDN | Vendoriser React/ReactDOM/Babel en local (`vendor/`) |
| Objectif | APK debug testable |
| Environnement de build | Android command-line tools + JDK (tout en CLI, automatisable) |
| appId | `com.fractalarena.app` |
| appName | `Fractal Arena` |

## Structure cible

```
FA Mobile/
  index.html              ← modifié : <script> pointent vers ./vendor/, viewport-fit=cover
  *.jsx *.js *.css        ← inchangés
  assets/                 ← inchangé
  vendor/                 ← NOUVEAU : react, react-dom, @babel/standalone copiés en local
  package.json            ← NOUVEAU
  capacitor.config.json   ← NOUVEAU : appId/appName/webDir=www
  scripts/copy-web.mjs    ← NOUVEAU : copie sources + vendor → www/
  www/                    ← généré (gitignore)
  android/                ← généré par Capacitor (build artifacts gitignore)
  .gitignore              ← NOUVEAU/mis à jour
```

## Détails de mise en œuvre

### 1. Vendoring des libs
- Télécharger dans `vendor/` : `react.production.min.js`, `react-dom.production.min.js`,
  `babel.min.js` (versions alignées sur celles déjà référencées : React 18.3.1, Babel 7.29.0,
  sauf incompatibilité — versions de prod plutôt que dev pour réduire la taille/le bruit).
- Modifier `index.html` :
  - remplacer les 3 `<script src="https://unpkg.com/...">` par `<script src="./vendor/...">` ;
  - retirer les attributs `integrity` et `crossorigin` (inutiles en local) ;
  - ajouter `viewport-fit=cover` au `<meta name="viewport">`.
- Comportement attendu : Babel transpile toujours les `.jsx` au runtime ; le webview les
  sert depuis `localhost`, donc le `fetch` des `.jsx` fonctionne. L'app démarre sans internet.

### 2. Script de build web (`scripts/copy-web.mjs`)
- Vide/recrée `www/`.
- Copie vers `www/` : `index.html`, `styles.css`, `mobile.css`, `data.js`, `i18n.js`,
  `engine.js`, `components.jsx`, `arena.jsx`, `screens.jsx`, `app.jsx`, `assets/`, `vendor/`.
- Exposé via `npm run build:web` (et appelé avant `cap sync`).

### 3. Projet Capacitor
- `package.json` avec dépendances `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
  `@capacitor/status-bar` et scripts (`build:web`, `sync`).
- `capacitor.config.json` : `appId=com.fractalarena.app`, `appName=Fractal Arena`,
  `webDir=www`.
- `npx cap add android` puis `npx cap sync`.

### 4. Adaptations natives minimales
- **Orientation portrait** : `android:screenOrientation="portrait"` sur l'activité dans
  `android/app/src/main/AndroidManifest.xml`.
- **Status bar** sombre cohérente avec le thème `#05070f` via `@capacitor/status-bar`
  (`StatusBar.setStyle({ style: Style.Dark })`), initialisé au démarrage de l'app.

### 5. Environnement de build (installation)
- **JDK** (version alignée sur la version de Capacitor retenue) via winget.
- **Android SDK cmdline tools** (`sdkmanager`) : installer `platform-tools`,
  `platforms;android-XX`, `build-tools;XX` et accepter les licences.
- Configurer `JAVA_HOME` et `ANDROID_HOME`/`ANDROID_SDK_ROOT` pour la session de build.

### 6. Build & livrable
- `npm install` → `npm run build:web` → `npx cap sync` →
  `cd android && ./gradlew assembleDebug`.
- Livrable : `android/app/build/outputs/apk/debug/app-debug.apk`.
- Installation : transfert direct sur l'appareil ou `adb install`.

## Versions

Capacitor, JDK et Android API seront fixés sur une **combinaison compatible connue**
(point de départ : Capacitor 6 / JDK 17 / Android API 34 ; mise à jour vers la dernière
stable uniquement si la compatibilité est vérifiée). Les versions exactes sont arrêtées à
l'implémentation et inscrites dans `package.json`.

## Vérification / critères de succès

1. `./gradlew assembleDebug` se termine sans erreur et génère `app-debug.apk`.
2. `www/` contient `index.html` (pointant vers `./vendor/`), les libs `vendor/`, tous les
   `.js`/`.jsx`/CSS et le dossier `assets/`.
3. Validation finale sur appareil réel par l'utilisateur (installation + lancement du jeu).

## Risques connus

- **Performance de boot** : Babel standalone transpile au runtime → démarrage plus lent
  qu'un bundle pré-compilé. Acceptable pour cette étape ; piste future = bundler (esbuild/Vite).
- **Compatibilité versions** Capacitor/JDK/AGP/Gradle : risque principal du build ;
  mitigé en épinglant une combinaison connue.
- **Téléchargement SDK** volumineux à la première installation.

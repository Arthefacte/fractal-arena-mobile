# Fractal Arena — app Android

Application Android **native** (Capacitor) du jeu réel : le même client web que
fractalarena.com, embarqué dans l'APK et servi depuis l'app, sans barre d'URL ni
service worker. Android uniquement (iOS se compile sur macOS, pas ici).

## Ce que fait ce dépôt

Le client est celui du dépôt **fractal-arena-web** — une seule source de vérité.
`www/` est **généré**, jamais édité à la main. La source est le clone voisin par
défaut, ou un worktree pinné sur `origin/main` via `FA_WEB_DIR` : **on ne livre
jamais depuis le clone partagé**, qui porte le travail non commité des autres
sessions.

```bash
npm install          # une fois
npm run icones       # icônes + écran de lancement (seulement si l'emblème change)
npm run apk          # génère www/, synchronise Capacitor, compile l'APK
# → android/app/build/outputs/apk/debug/app-debug.apk

# Depuis une version précise du client (worktree pinné) :
FA_WEB_DIR=".../wt-app-web" npm run apk
```

Le `versionCode` de l'APK et son `versionName` sont **écrits par le build à
partir de la version du client** (« 1.0 (client v335) ») : une APK sait toujours
quelle version du jeu elle embarque.

## Les trois écarts entre le web et l'app

Appliqués par `scripts/sync-web.mjs`, qui **échoue** si une ancre a bougé :

1. **API** — `data.js` vise `http://localhost:3000` dès que l'hôte est
   « localhost » ; Capacitor sert l'app depuis `https://localhost`. `native-env.js`
   (inséré juste après `data.js`) force l'API de production. Sans lui, l'app
   appellerait un serveur absent du téléphone.
2. **App installée** — `navigator.standalone` est déclaré vrai : c'est la
   définition d'une app native, et c'est ce qui met la session en `localStorage`
   (sinon déconnexion à chaque fermeture) et supprime la bannière
   « installer l'app » à l'intérieur de l'app.
3. **Installation** — service worker retiré (il mettrait les assets locaux en
   cache et survivrait à une mise à jour de l'APK, donc servirait une vieille
   version). React n'est **jamais** pris sur un CDN : le client l'auto-héberge
   depuis la v335 (`vendor/react*.js`), et avant cela l'app le rapatriait
   elle-même dans l'APK, SRI vérifiée au build.

Ne sont **pas** copiés : `art/`, `docs/`, `ds-bundle/`, `test/`, `tools/`,
protos HTML, service worker, fichiers d'infra.

## Contrôles avant de livrer

```bash
node scripts/verif-www.mjs      # le bundle démarre : zéro 404, API de prod, écran de titre
node scripts/verif-accueil.mjs  # passe la cinématique, lit l'accueil (ne crée AUCUN compte)
```

Les deux scripts pilotent un Chromium headless (Playwright déjà installé sur ce
poste, chemin en dur dans les scripts — outillage local, pas de dépendance de
build). Le second écrit `capture-accueil.png`.

## Publier une version téléchargeable

```bash
npm run apk:release     # build SIGNÉ (clé de release) → FractalArena-android.apk
gh release create v<version> "FractalArena-android.apk" --repo Arthefacte/fractal-arena-mobile
```

- La clé de signature vit **hors du dépôt** : `~/.fa-secrets/android/` (`.jks` +
  `keystore.properties`), créée une fois par `node scripts/creer-cle-release.mjs`.
  Elle doit être **sauvegardée ailleurs** : la perdre, c'est ne plus pouvoir livrer
  de mise à jour qui s'installe par-dessus l'app déjà installée.
- Le nom du fichier publié (`FractalArena-android.apk`) est un **contrat public** :
  la vitrine arthefacte.com pointe
  `releases/latest/download/FractalArena-android.apk`. Garder ce nom à chaque
  release — sinon le bouton du site casse.

## Limites connues, à savoir avant de promettre

- **La signature wallet impossible dans l'app** : le seul chemin de signature sur
  téléphone est le navigateur intégré d'UniSat (`openDapp`), qui sort de l'app.
  Le compte généré (sans wallet) fonctionne entièrement, c'est le parcours par
  défaut ; la liaison wallet se fait sur la version web.
- **Chaque mise à jour du jeu = une nouvelle APK.** Le client est embarqué : une
  correction livrée sur le web n'atteint pas les joueurs de l'app tant qu'une
  version n'est pas publiée. À trancher : publication fréquente, ou shell qui
  recharge le client depuis le domaine.
- **APK de debug** : signée par la clé de debug, installable par sideload. Une
  mise en ligne Play demande une clé de release (à créer et conserver), un AAB,
  et un `targetSdk` à jour (Play exige plus récent que le 34 actuel).
- **Contenu magasin** : cf. `AUDIT-CONFORMITE-APPLE-2026-08-17.md` du dossier —
  dépôt, retrait, liens InSwap, poussière de FB et lexique « gains/sats » sont à
  retirer d'un build destiné à un magasin (Apple comme Google).


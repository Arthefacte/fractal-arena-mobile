"""Analyse d'un enregistrement d'écran de téléphone (fichier vidéo).

Répond à : où l'écran s'est-il FIGÉ, combien de temps, et que montrait-il ?
Un enregistrement d'écran est la seule mesure de fluidité qui vaille : c'est le
téléphone lui-même qui parle, pas un navigateur de bureau dans un émulateur.

Méthode : on réduit chaque image à 64x64 en niveaux de gris, on compare chaque
image à la précédente, et on date les gels (suites d'images identiques). Les
horodatages viennent des PTS réels du fichier — un enregistrement Android est à
cadence variable, compter les images ne donne pas des secondes.

Usage :
  python scripts/analyse-enregistrement.py --video enreg.mp4 [--seuil 1.0]
      [--images dossier]   # extraire l'image de début de chaque gel (pleine résolution)
"""
import argparse, os, re, shutil, subprocess, sys, tempfile

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"


def horodatages(video):
    out = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "frame=pts_time", "-of", "csv=p=0", video],
                         capture_output=True, text=True).stdout
    t = [float(x) for x in re.findall(r"[0-9]+\.[0-9]+", out)]
    return t


def images_grises(video, taille=64):
    tmp = tempfile.mkdtemp()
    chemin = os.path.join(tmp, "gris.raw")
    subprocess.run([FFMPEG, "-v", "error", "-i", video, "-vf",
                    f"scale={taille}:{taille}:flags=area,format=gray", "-f", "rawvideo",
                    "-y", chemin], check=True)
    with open(chemin, "rb") as f:
        brut = f.read()
    shutil.rmtree(tmp, ignore_errors=True)
    n = taille * taille
    return [brut[i:i + n] for i in range(0, len(brut) - n + 1, n)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--seuil", type=float, default=1.0, help="écart moyen mini pour compter un mouvement")
    ap.add_argument("--images", default="", help="dossier où extraire l'image de début de chaque gel")
    ap.add_argument("--gel-min", type=float, default=0.3, help="durée mini d'un gel à signaler (s)")
    a = ap.parse_args()

    temps = horodatages(a.video)
    images = images_grises(a.video)
    n = min(len(temps), len(images))
    temps, images = temps[:n], images[:n]
    if n < 3:
        sys.exit("vidéo illisible ou trop courte (%d images)" % n)
    duree = temps[-1] - temps[0]
    print(f"{a.video}\n  {n} images, {duree:.1f} s, {n / max(duree, 0.001):.1f} images/s en moyenne")

    ecarts = []
    for i in range(1, n):
        x, y = images[i - 1], images[i]
        ecarts.append(sum(abs(p - q) for p, q in zip(x, y)) / len(x))

    mobiles = sum(1 for e in ecarts if e > a.seuil)
    print(f"  images qui CHANGENT : {mobiles}/{len(ecarts)} ({100 * mobiles / len(ecarts):.0f} %)")
    print(f"  écart moyen quand ça bouge : "
          f"{sum(ecarts) / len(ecarts):.2f}/255 sur l'image entière")

    # Gels : suites d'images identiques (<= seuil), datées en secondes réelles.
    gels, debut = [], None
    for i, e in enumerate(ecarts):
        if e <= a.seuil:
            if debut is None:
                debut = temps[i]
        else:
            if debut is not None:
                if temps[i] - debut >= a.gel_min:
                    gels.append((debut, temps[i] - debut))
                debut = None
    if debut is not None and temps[n - 1] - debut >= a.gel_min:
        gels.append((debut, temps[n - 1] - debut))

    print(f"\n  GELS >= {a.gel_min}s : {len(gels)}")
    for t, d in sorted(gels, key=lambda g: -g[1])[:12]:
        print(f"    à {t:6.2f} s : {d:5.2f} s figées")

    # Profil par tranche de 5 s : ce qui bouge, ce qui est figé.
    print("\n  profil (tranches de 5 s) : mouvement moyen, images figées")
    tranche = 5.0
    total = int(duree // tranche) + 1
    for k in range(total):
        t0, t1 = k * tranche, (k + 1) * tranche
        idx = [i for i in range(len(ecarts)) if t0 <= temps[i] < t1]
        if not idx:
            continue
        moy = sum(ecarts[i] for i in idx) / len(idx)
        figees = sum(1 for i in idx if ecarts[i] <= a.seuil)
        barre = "#" * int(moy)
        print(f"    {t0:5.0f}-{t1:5.0f} s : {moy:5.2f} {barre:<40} figées {figees}/{len(idx)}")

    if a.images and gels:
        os.makedirs(a.images, exist_ok=True)
        for j, (t, d) in enumerate(gels):
            cible = os.path.join(a.images, f"gel{j:02d}_{t:.1f}s.png")
            subprocess.run([FFMPEG, "-v", "error", "-ss", f"{t + d / 2:.2f}", "-i", a.video,
                            "-frames:v", "1", "-y", cible], check=False)
            print(f"    image extraite : {cible}")


if __name__ == "__main__":
    main()

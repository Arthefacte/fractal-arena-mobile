"""État de la zone de l'emblème sur les images réellement affichées.

Sortie : pour chaque image échantillonnée, la luminosité moyenne de la zone de
l'emblème et une empreinte grossière (arrondie) — deux images de même empreinte
montrent la même chose. Répond à : « l'emblème est-il dessiné, et change-t-il ? »

Usage : python scripts/etat-bande.py --images img-d --sonde mesure-d.json [--pas 4]
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--sonde", required=True)
    ap.add_argument("--pas", type=int, default=6, help="échantillonner une image sur N")
    ap.add_argument("--taille", type=int, default=24)
    a = ap.parse_args()

    d = json.load(open(a.sonde, encoding="utf-8"))
    dec = d["decalage"]
    rect, fen = d["brut"]["rect"], d["brut"]["fenetre"]
    fichiers = sorted(
        ((int(m.group(1)), os.path.join(a.images, f)) for f in os.listdir(a.images) for m in [re.match(r"n(\d+)\.jpg$", f)] if m),
    )
    if not fichiers:
        sys.exit("aucune image")
    # Les images du screencast font la taille de la fenêtre en pixels CSS.
    lw, lh = 412, 915
    ech = 1.0
    tmp = tempfile.mkdtemp()
    try:
        print(f"{len(fichiers)} images, zone emblème {rect['w']:.0f}x{rect['h']:.0f} en ({rect['x']:.0f},{rect['y']:.0f})")
        for i, (tn, chemin) in enumerate(fichiers):
            if i % a.pas:
                continue
            cible = os.path.join(tmp, "u.jpg")
            shutil.copyfile(chemin, cible)
            vf = (f"crop={int(rect['w'])}:{int(rect['h'])}:{int(rect['x'])}:{int(rect['y'])},"
                  f"scale={a.taille}:{a.taille}:flags=area,format=gray")
            r = subprocess.run([FFMPEG, "-v", "error", "-i", cible, "-vf", vf, "-f", "rawvideo", "-"],
                               capture_output=True)
            brut = r.stdout
            if not brut:
                print(f"  t={tn - dec:>6.0f} ms  (ffmpeg n'a rien rendu)")
                continue
            moy = sum(brut) / len(brut)
            empreinte = "".join(f"{v >> 5:x}" for v in brut[:: max(1, len(brut) // 12)])
            print(f"  t={tn - dec:>6.0f} ms  luma {moy:6.1f}  empreinte {empreinte}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()

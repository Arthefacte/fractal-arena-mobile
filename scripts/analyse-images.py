"""Analyse des images RÉELLEMENT affichées pendant les blocages du fil principal.

Entrée : les images d'un screencast (sonde-demarrage.mjs --images DIR) + le JSON
de la sonde. Sortie : pour chaque blocage du fil principal, est-ce que la zone de
l'emblème CHANGE d'une image à l'autre pendant ce blocage ?

C'est la seule mesure qui distingue « l'animation continue » de « l'écran est
figé » : le fil JS peut être bloqué sans que l'affichage s'arrête (animation
composée), et un timer JS qui avance ne prouve rien sur ce qui est peint.

Usage :
  python scripts/analyse-images.py --images img-avant --sonde avant-cpu4.json
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


def dimension(path):
    out = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-frames:v", "1",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.search(r"(\d{2,5})x(\d{2,5})", out)
    if not m:
        out2 = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                               "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                              capture_output=True, text=True).stdout
        m = re.search(r"(\d+),(\d+)", out2)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def images_ordonnees(dossier):
    out = []
    for f in sorted(os.listdir(dossier)):
        m = re.match(r"n(\d+)\.jpg$", f)
        if m:
            out.append((int(m.group(1)), os.path.join(dossier, f)))
    return out


def diff_successives(chemins, crop, taille=32):
    """Écart moyen par pixel entre images consécutives, dans la zone croppée."""
    tmp = tempfile.mkdtemp()
    try:
        for i, c in enumerate(chemins):
            shutil.copyfile(c, os.path.join(tmp, f"{i:05d}.jpg"))
        x, y, w, h = crop
        vf = f"crop={w}:{h}:{x}:{y},scale={taille}:{taille}:flags=area,format=rgb24"
        r = subprocess.run([FFMPEG, "-v", "error", "-i", os.path.join(tmp, "%05d.jpg"),
                            "-vf", vf, "-f", "rawvideo", "-"], capture_output=True)
        if r.returncode != 0:
            return [], r.stderr.decode(errors="replace")[:300]
        buf, n = r.stdout, taille * taille * 3
        nb = len(buf) // n
        ecarts = []
        for i in range(1, nb):
            a, b = buf[(i - 1) * n:i * n], buf[i * n:(i + 1) * n]
            ecarts.append(sum(abs(p - q) for p, q in zip(a, b)) / n)
        return ecarts, None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--sonde", required=True)
    ap.add_argument("--seuil", type=float, default=1.0, help="écart mini pour compter une image comme « changée »")
    ap.add_argument("--tout", action="store_true", help="analyser la fenêtre entière, pas seulement les blocages")
    ap.add_argument("--fin", type=float, default=None, help="fin de fenêtre en ms (défaut : retrait du splash)")
    a = ap.parse_args()

    d = json.load(open(a.sonde, encoding="utf-8"))
    decalage = d["decalage"]  # tempsPage = tempsNode - decalage
    rect = d["brut"]["rect"]
    fen = d["brut"]["fenetre"]
    imgs = images_ordonnees(a.images)
    if not imgs:
        sys.exit(f"aucune image dans {a.images}")
    lw, lh = dimension(imgs[0][1])
    ech = lw / fen["l"] if lw and fen else 1.0
    x = max(0, int(rect["x"] * ech))
    y = max(0, int(rect["y"] * ech))
    w = min(lw - x, max(8, int(rect["w"] * ech)))
    h = min(lh - y, max(8, int(rect["h"] * ech)))
    print(f"images {lw}x{lh} (fenêtre {fen['l']}x{fen['h']}, dpr {fen['dpr']}) → zone emblème {w}x{h} en ({x},{y})")
    print(f"{len(imgs)} images affichées conservées\n")

    blocages = [b for b in d["rapport"]["blocages"] if b["blocageMs"] >= 150]
    if a.tout:
        # Fenêtre ENTIÈRE : combien de fois l'emblème change-t-il, et où sont les
        # gels ? Un comptage global ne dépend pas de l'alignement de phase : si
        # l'animation tourne, l'assemblage (1,5 s par cycle de 4,1 s) produit ~31
        # changements par cycle.
        t0, t1 = 0, (a.fin if a.fin else d["rapport"]["jalons"].get("splashRetire", 1e9))
        sel = [(tn, p) for (tn, p) in imgs if t0 <= tn - decalage <= t1]
        ecarts, err = diff_successives([p for _, p in sel], (x, y, w, h))
        if err:
            sys.exit("ffmpeg : " + err)
        horo = [tn - decalage for tn, _ in sel]
        changes = sum(1 for e in ecarts if e > a.seuil)
        gel = plus = 0
        gels = []
        for i, e in enumerate(ecarts):
            if e <= a.seuil:
                gel += horo[i + 1] - horo[i]
                if gel > plus:
                    plus = gel
            else:
                if gel > 300:
                    gels.append((round(horo[i] - gel), round(gel)))
                gel = 0
        print(f"FENÊTRE ENTIÈRE : {len(sel)} images jusqu'au retrait du splash ({round(t1)} ms)")
        print(f"  changements : {changes} (écart > {a.seuil}) sur {len(ecarts)} paires")
        print(f"  gel le plus long : {plus:.0f} ms")
        print(f"  gels > 300 ms : {' '.join(f'@{t}+{g}ms' for t, g in gels) if gels else 'aucun'}")
        blocages = [b for b in d["rapport"]["blocages"] if b["blocageMs"] >= 150]
    print(f"Blocages du fil principal analysés : {len(blocages)}\n")
    total_gel, total_fenetre = 0, 0
    for b in blocages:
        t0, t1 = b["debut"], b["debut"] + b["blocageMs"]
        sel = [p for (tn, p) in imgs if t0 <= tn - decalage <= t1]
        if len(sel) < 2:
            print(f"  blocage {b['blocageMs']:>7.0f} ms @{t0:>6} : {len(sel)} image(s) — pas de quoi conclure")
            continue
        ecarts, err = diff_successives(sel, (x, y, w, h))
        if err:
            print(f"  blocage @{t0} : ffmpeg a échoué — {err}")
            continue
        changes = [e for e in ecarts if e > a.seuil]
        # Plus longue suite d'images identiques (gel), en millisecondes.
        horodatage = [tn - decalage for (tn, _) in imgs if t0 <= tn - decalage <= t1]
        gel = plus_longue_gel = 0
        for i, e in enumerate(ecarts):
            if e <= a.seuil:
                gel += horodatage[i + 1] - horodatage[i]
                plus_longue_gel = max(plus_longue_gel, gel)
            else:
                gel = 0
        total_gel += plus_longue_gel
        total_fenetre += b["blocageMs"]
        med = sorted(ecarts)[len(ecarts) // 2]
        print(f"  blocage {b['blocageMs']:>7.0f} ms @{t0:>6} : {len(sel)} images, "
              f"{len(changes)} changements, écart médian {med:5.1f}, GEL MAX {plus_longue_gel:.0f} ms")
    if total_fenetre:
        print(f"\nGel cumulé sur les blocages : {total_gel:.0f} ms / {total_fenetre:.0f} ms analysés "
              f"({100 * total_gel / total_fenetre:.0f} %)")


if __name__ == "__main__":
    main()

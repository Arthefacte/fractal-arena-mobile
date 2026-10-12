#!/usr/bin/env python3
"""Fractal Arena — archive du client web pour la mise à jour de l'app Android.

Usage : zip-bundle.py <dossier-source> <archive.zip>

Les entrées sont à la RACINE de l'archive (arcname relatif à la source) : c'est
ce que le plugin d'update installe, il remplace le dossier web tel quel. Ni
PowerShell (lent, et son invocation a échoué depuis Node) ni zip/7z (absents du
poste) : la bibliothèque standard fait le travail, et l'archive produite est
vérifiable ligne à ligne.
"""
import os
import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: zip-bundle.py <source> <archive.zip>", file=sys.stderr)
        return 2
    source, cible = sys.argv[1], sys.argv[2]
    if not os.path.isdir(source):
        print("dossier introuvable : " + source, file=sys.stderr)
        return 2

    os.makedirs(os.path.dirname(cible) or ".", exist_ok=True)
    fichiers = 0
    with zipfile.ZipFile(cible, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for racine, _dossiers, noms in os.walk(source):
            for nom in sorted(noms):
                chemin = os.path.join(racine, nom)
                # Chemin RELATIF à la source, séparateurs POSIX : une archive de
                # web bundle se lit avec « / », même construite sous Windows.
                arc = os.path.relpath(chemin, source).replace(os.sep, "/")
                z.write(chemin, arc)
                fichiers += 1

    # Contrôle immédiat : une archive illisible partirait telle quelle sur le
    # téléphone et l'app retomberait en arrière sans rien dire.
    with zipfile.ZipFile(cible) as z:
        mauvais = z.testzip()
        if mauvais is not None:
            print("archive corrompue : " + mauvais, file=sys.stderr)
            return 1

    print(f"archive : {cible} ({os.path.getsize(cible) / 1048576:.1f} Mo, {fichiers} fichiers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

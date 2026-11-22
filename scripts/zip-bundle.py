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
import stat
import sys
import zipfile


class EntreeBundleInvalide(Exception):
    pass


def est_dans_racine(racine: str, cible: str) -> bool:
    try:
        commun = os.path.commonpath((racine, cible))
    except ValueError:
        return False
    return os.path.normcase(commun) == os.path.normcase(racine)


def verifier_entree(source_reelle: str, chemin: str, dossier: bool) -> None:
    relatif = os.path.relpath(chemin, source_reelle)
    info = os.lstat(chemin)
    if stat.S_ISLNK(info.st_mode):
        raise EntreeBundleInvalide("lien symbolique interdit : " + relatif)
    type_attendu = stat.S_ISDIR(info.st_mode) if dossier else stat.S_ISREG(info.st_mode)
    if not type_attendu:
        raise EntreeBundleInvalide("entrée non régulière interdite : " + relatif)
    if not est_dans_racine(source_reelle, os.path.realpath(chemin)):
        raise EntreeBundleInvalide("entrée hors de la source : " + relatif)


def relayer_erreur_parcours(exc: OSError) -> None:
    raise exc


def lister_fichiers(source: str, source_reelle: str):
    fichiers = []
    for racine, dossiers, noms in os.walk(
        source, topdown=True, onerror=relayer_erreur_parcours, followlinks=False
    ):
        for nom in dossiers:
            verifier_entree(source_reelle, os.path.join(racine, nom), dossier=True)
        for nom in sorted(noms):
            chemin = os.path.join(racine, nom)
            verifier_entree(source_reelle, chemin, dossier=False)
            arc = os.path.relpath(chemin, source).replace(os.sep, "/")
            fichiers.append((chemin, arc))
    return fichiers


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: zip-bundle.py <source> <archive.zip>", file=sys.stderr)
        return 2
    source, cible = os.path.abspath(sys.argv[1]), sys.argv[2]
    try:
        source_info = os.lstat(source)
    except OSError:
        print("dossier introuvable : " + source, file=sys.stderr)
        return 2
    if stat.S_ISLNK(source_info.st_mode) or not stat.S_ISDIR(source_info.st_mode):
        print("source non sûre (dossier réel requis) : " + source, file=sys.stderr)
        return 2
    source_reelle = os.path.realpath(source)

    try:
        a_archiver = lister_fichiers(source, source_reelle)
    except (EntreeBundleInvalide, OSError) as exc:
        print("source non sûre : " + str(exc), file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(cible) or ".", exist_ok=True)
    fichiers = 0
    with zipfile.ZipFile(cible, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for chemin, arc in a_archiver:
            # Vérifié de nouveau au plus près de la lecture : un chemin remplacé
            # depuis l'inventaire ne doit pas être déréférencé par ZipFile.write.
            verifier_entree(source_reelle, chemin, dossier=False)
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

"""
Prépare les données communales de l'observatoire.

Entrées  (data/sources/, saisies ou déposées à la main)
  - saisie_valeurs_NCPA.xlsx : classeur de saisie (onglets Valeurs, Indicateurs, Communes, Sources)
  - communes.geojson         : contours communaux IGN

Sorties  (data/processed/, versionnées dans Git, format long)
  - valeurs_communes.csv     : 1 ligne = 1 commune × 1 année × 1 indicateur × 1 valeur
  - indicateurs.csv          : référentiel des indicateurs
  - communes.csv             : code INSEE, nom, superficie
  - sources.csv              : référentiel des sources
  - communes_simpl.geojson   : contours simplifiés pour le web (~90 Ko)

Usage : python scripts/build_data.py
"""
from pathlib import Path
import json
import sys

import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "data" / "sources"
OUT = RACINE / "data" / "processed"
CLASSEUR = SRC / "saisie_valeurs_NCPA.xlsx"
GEOJSON = SRC / "communes.geojson"

# Tolérance de simplification des contours, en degrés (~13 m à 49° N)
EPS_SIMPLIF = 0.00012
DECIMALES_GEO = 5


def ecrire_csv(df: pd.DataFrame, nom: str) -> None:
    """CSV UTF-8, séparateur virgule, tri stable : des diffs Git lisibles d'un millésime à l'autre."""
    chemin = OUT / nom
    df.to_csv(chemin, index=False, encoding="utf-8", lineterminator="\n")
    print(f"  {nom:28s} {len(df):>7d} lignes")


def preparer_classeur() -> None:
    v = pd.read_excel(CLASSEUR, sheet_name="Valeurs", dtype={"code_geo": str})
    ind = pd.read_excel(CLASSEUR, sheet_name="Indicateurs")
    com = pd.read_excel(CLASSEUR, sheet_name="Communes", dtype={"code_insee": str})
    src = pd.read_excel(CLASSEUR, sheet_name="Sources")

    vides = v["valeur"].isna().sum()
    if vides:
        print(f"  ({vides} lignes sans valeur écartées)")
    v = v.dropna(subset=["valeur"]).copy()
    v["scenario"] = v["scenario"].fillna("")
    v["annee"] = v["annee"].astype(int)
    v = v.sort_values(["id_indicateur", "scenario", "code_geo", "annee"])

    ecrire_csv(v, "valeurs_communes.csv")
    ecrire_csv(ind, "indicateurs.csv")
    ecrire_csv(src, "sources.csv")
    return com


def rdp(pts, eps):
    """Ramer-Douglas-Peucker : retire les sommets superflus en conservant la forme."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = (dx * dx + dy * dy) ** 0.5
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / n if n else ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def simplifier_anneau(anneau):
    p = [tuple(c[:2]) for c in anneau]
    s = rdp(p, EPS_SIMPLIF)
    if len(s) < 4:  # anneau trop petit : on garde un échantillon plutôt que de le perdre
        s = p[:: max(1, len(p) // 8)] + [p[0]]
    if s[0] != s[-1]:
        s.append(s[0])
    return [[round(x, DECIMALES_GEO), round(y, DECIMALES_GEO)] for x, y in s]


def preparer_contours(com: pd.DataFrame) -> None:
    gj = json.loads(GEOJSON.read_text(encoding="utf-8"))
    feats, surfaces = [], []
    for f in gj["features"]:
        p = f["properties"]
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        coords = []
        for poly in polys:
            anneaux = [a for a in (simplifier_anneau(r) for r in poly) if len(a) >= 4]
            if anneaux:
                coords.append(anneaux)
        feats.append({
            "type": "Feature",
            "properties": {"code_insee": p["code_insee"], "nom": p.get("nom_officiel")},
            "geometry": {"type": "MultiPolygon", "coordinates": coords},
        })
        surfaces.append({"code_insee": p["code_insee"],
                         "superficie_km2": round(p["superficie_cadastrale"] / 100, 2)})

    (OUT / "communes_simpl.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")
    print(f"  {'communes_simpl.geojson':28s} {len(feats):>7d} contours")

    # Référentiel communal = onglet Communes + superficie cadastrale issue du fond IGN
    com = com.merge(pd.DataFrame(surfaces), on="code_insee", how="left")
    manquantes = com[com["superficie_km2"].isna()]["code_insee"].tolist()
    if manquantes:
        print(f"  ATTENTION : superficie absente pour {manquantes}")
    ecrire_csv(com.sort_values("code_insee"), "communes.csv")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    print("Préparation des données communales")
    com = preparer_classeur()
    preparer_contours(com)
    return 0


if __name__ == "__main__":
    sys.exit(main())

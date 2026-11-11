"""
Référentiel des EPCI à fiscalité propre (périmètres, nature, communes membres).

Source : Etalab, paquet @etalab/decoupage-administratif (Code officiel géographique INSEE).
Version figée ci-dessous : la monter volontairement après chaque nouveau COG (janvier).

Sorties (data/processed/, format long)
  - epci_ref.csv      : 1 ligne par EPCI (SIREN, nom, nature, population, département principal)
  - epci_membres.csv  : 1 ligne par couple EPCI × commune membre

Usage : python scripts/fetch_epci.py              (téléchargement)
        python scripts/fetch_epci.py --local DIR   (fichiers epci.json et communes.json déjà présents)
"""
from collections import Counter
from pathlib import Path
import argparse
import json
import sys

import pandas as pd
import requests

VERSION = "6.0.0"
BASE = f"https://cdn.jsdelivr.net/npm/@etalab/decoupage-administratif@{VERSION}/data"
RACINE = Path(__file__).resolve().parent.parent
OUT = RACINE / "data" / "processed"


def charger(nom, local):
    if local:
        return json.loads((Path(local) / nom).read_text(encoding="utf-8"))
    r = requests.get(f"{BASE}/{nom}", timeout=120)
    r.raise_for_status()
    return r.json()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="dossier contenant epci.json et communes.json")
    args = ap.parse_args()

    print(f"Référentiel EPCI (Etalab {VERSION})")
    epci = charger("epci.json", args.local)
    communes = charger("communes.json", args.local)
    geo = {c["code"]: c for c in communes if c.get("type") == "commune-actuelle"}

    ref, membres = [], []
    for e in epci:
        poids = Counter()
        for m in e["membres"]:
            c = geo.get(m["code"], {})
            pop = m.get("populationMunicipale") or 0
            poids[(c.get("departement"), c.get("region"))] += pop
            membres.append({"siren_epci": e["code"], "code_insee": m["code"], "nom_commune": m["nom"],
                            "departement": c.get("departement"), "region": c.get("region"),
                            "population_municipale": pop})
        (dep, reg), _ = poids.most_common(1)[0] if poids else ((None, None), 0)
        ref.append({"siren": e["code"], "nom": e["nom"], "nature": e.get("type"),
                    "mode_financement": e.get("modeFinancement"),
                    "population_municipale": e.get("populationMunicipale"),
                    "nb_communes": len(e["membres"]),
                    "departement_principal": dep, "region_principale": reg,
                    "departements": "|".join(sorted({k[0] for k in poids if k[0]}))})

    OUT.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(ref).sort_values("siren").to_csv(OUT / "epci_ref.csv", index=False, lineterminator="\n")
    pd.DataFrame(membres).sort_values(["siren_epci", "code_insee"]).to_csv(
        OUT / "epci_membres.csv", index=False, lineterminator="\n")
    print(f"  epci_ref.csv      {len(ref):>6d} EPCI")
    print(f"  epci_membres.csv  {len(membres):>6d} communes membres")

    ncpa = next((r for r in ref if r["siren"] == "200065563"), None)
    if not ncpa:
        print("ERREUR : NCPA absente du référentiel")
        return 1
    print(f"  NCPA : {ncpa['nom']}, {ncpa['nb_communes']} communes, dép. {ncpa['departement_principal']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

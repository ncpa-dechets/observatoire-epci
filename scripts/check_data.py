"""
Contrôles de cohérence des données traitées.

Chaque contrôle formalise une vérification faite à la main lors de la construction
du tableau de bord. Une ERREUR bloque la publication ; un AVERTISSEMENT est signalé
dans l'interface de GitHub Actions sans bloquer.

Usage : python scripts/check_data.py
"""
from pathlib import Path
import json
import os
import sys

import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
P = RACINE / "data" / "processed"
EN_CI = os.environ.get("GITHUB_ACTIONS") == "true"

NB_COMMUNES = 38
# Indicateurs stockés en fraction (0-1) alors que l'unité déclarée est « % »
FRACTION = {"I092", "I093", "I094", "I097", "I099", "I383"}
# Indicateurs stockés en vrai pourcentage (0-100)
POURCENT = {"I055", "I075", "I076", "I078", "I079"}

erreurs, avertissements = [], []


def erreur(msg):
    erreurs.append(msg)
    print(f"::error::{msg}" if EN_CI else f"  ERREUR  {msg}")


def avert(msg):
    avertissements.append(msg)
    print(f"::warning::{msg}" if EN_CI else f"  ATTENTION  {msg}")


def ok(msg):
    print(f"  ok  {msg}")


def table(v):
    """Accès rapide : (indicateur, scénario, commune, année) -> valeur."""
    return {(r.id_indicateur, r.scenario, r.code_geo, r.annee): r.valeur
            for r in v.itertuples()}


def controle_somme(t, total, parties, libelle, tol=0.01):
    n = ko = 0
    for (i, sc, c, a), val in t.items():
        if i != total or sc:
            continue
        comp = [t.get((p, "", c, a)) for p in parties]
        if any(x is None for x in comp):
            continue
        n += 1
        if abs(val - sum(comp)) > tol:
            ko += 1
    if n == 0:
        avert(f"{libelle} : aucun couple testable")
    elif ko:
        erreur(f"{libelle} : {ko} incohérences sur {n} couples")
    else:
        ok(f"{libelle} ({n} couples)")


def main() -> int:
    print("Contrôles de cohérence")
    v = pd.read_csv(P / "valeurs_communes.csv", dtype={"code_geo": str, "scenario": str},
                    keep_default_na=False, na_values=[""])
    v["scenario"] = v["scenario"].fillna("")
    com = pd.read_csv(P / "communes.csv", dtype={"code_insee": str})
    t = table(v)

    # 1. Périmètre
    nc = v["code_geo"].nunique()
    (ok if nc == NB_COMMUNES else erreur)(f"{nc} communes dans les valeurs (attendu {NB_COMMUNES})")

    # 2. Identités comptables
    controle_somme(t, "I039", ["I040", "I041", "I042"], "Parc : I039 = RP + RS + vacants")
    controle_somme(t, "I390", ["I392", "I394", "I396"], "Places-lits : I390 = VV + RT + AJ")
    controle_somme(t, "I388", ["I391", "I393", "I395"], "Établissements : I388 = VV + RT + AJ")

    # 3. Conventions d'échelle des pourcentages (garde-fou contre un changement silencieux)
    for ind in sorted(FRACTION):
        s = v.loc[v.id_indicateur == ind, "valeur"]
        if len(s) and (s.max() > 1.0001 or s.min() < 0):
            erreur(f"{ind} devrait être une fraction 0-1, valeurs entre {s.min()} et {s.max()}")
    for ind in sorted(POURCENT):
        s = v.loc[v.id_indicateur == ind, "valeur"]
        if len(s) and s.abs().max() <= 1.0001:
            avert(f"{ind} est censé être en % 0-100 mais toutes ses valeurs sont ≤ 1")
    ok("conventions d'échelle des pourcentages")

    # 4. Référentiel communal et superficies
    sans_surface = com[com["superficie_km2"].isna()]["code_insee"].tolist()
    if sans_surface:
        erreur(f"superficie manquante : {sans_surface}")
    else:
        ok("superficie renseignée pour toutes les communes")

    # 5. Contours : rattachement au code INSEE
    gj = json.loads((P / "communes_simpl.geojson").read_text(encoding="utf-8"))
    codes_geo = {f["properties"]["code_insee"] for f in gj["features"]}
    codes_val = set(v["code_geo"])
    if codes_geo != codes_val:
        erreur(f"contours / valeurs non concordants : {sorted(codes_geo ^ codes_val)}")
    else:
        ok("contours rattachés aux 38 communes")

    # 6. Plausibilité démographique : saut annuel > 20 % sur une commune de plus de 500 habitants
    pop = v[v.id_indicateur == "I001"].pivot_table(index="code_geo", columns="annee", values="valeur")
    sauts = []
    for c, ligne in pop.iterrows():
        prec = None
        for a, x in ligne.dropna().items():
            if prec and prec > 500 and abs(x / prec - 1) > 0.20:
                sauts.append(f"{c} {a}")
            prec = x
    if sauts:
        avert(f"variation de population > 20 % en un an : {sauts}")
    else:
        ok("aucune variation démographique annuelle aberrante")

    # 7. Indicateurs déclarés mais vides
    ind = pd.read_csv(P / "indicateurs.csv")
    vides = sorted(set(ind["id_indicateur"]) & {f"I{n:03d}" for n in range(397, 402)} - set(v["id_indicateur"]))
    if vides:
        avert(f"indicateurs déclarés sans aucune valeur : {', '.join(vides)}")

    # 8. Base EPCI (facultative tant que fetch_insee.py n'a pas tourné)
    fe = P / "epci_insee.csv"
    if fe.exists():
        e = pd.read_csv(fe, dtype={"code_geo": str}, nrows=5_000_000)
        n_epci = e["code_geo"].nunique()
        (ok if n_epci > 1200 else avert)(f"base EPCI INSEE : {n_epci} EPCI")
        if "200065563" not in set(e["code_geo"]):
            erreur("NCPA (200065563) absente de la base EPCI INSEE")

    print(f"\n{len(erreurs)} erreur(s), {len(avertissements)} avertissement(s)")
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())

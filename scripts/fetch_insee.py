"""
Base du comparateur de territoires INSEE — extraction des EPCI et du niveau France.

Source  : https://www.insee.fr/fr/statistiques/2521169 (une trentaine d'indicateurs,
          RP, Filosofi, Flores, état civil ; toutes géographies ; format restructuré
          en juillet 2026, structure longue documentée sur la page).
Fichier : parquet, ~9 Mo.

Sorties (data/processed/, format long)
  - epci_insee.csv        : 1 ligne = 1 territoire × 1 période × 1 mesure × 1 valeur
  - epci_mesures.csv      : catalogue des mesures (libellé, unité, couverture)
  - epci_insee_meta.json  : empreinte du fichier source, date d'extraction

Le téléchargement est ignoré si le fichier source n'a pas changé (empreinte SHA-256) :
pas de commit inutile lors des exécutions mensuelles.

Usage : python scripts/fetch_insee.py                       (téléchargement)
        python scripts/fetch_insee.py --local comparateur.parquet
        python scripts/fetch_insee.py --force                (retraite même si inchangé)

⚠ Écrit d'après la documentation INSEE, pas encore éprouvé sur le fichier réel :
  au premier passage, lire l'inventaire affiché et ajuster COLONNES si besoin.
"""
from datetime import date
from pathlib import Path
import argparse
import hashlib
import json
import sys

import pandas as pd
import requests

URL = "https://www.insee.fr/fr/statistiques/fichier/2521169/comparateur.parquet"
RACINE = Path(__file__).resolve().parent.parent
RAW = RACINE / "data" / "raw"
OUT = RACINE / "data" / "processed"
META = OUT / "epci_insee_meta.json"
SIREN_NCPA = "200065563"

# Colonnes documentées par l'INSEE (structure de juillet 2026)
COLONNES = ["GEO_OBJECT", "GEO_OBJECT_LABEL", "GEO", "GEO_LABEL", "TIME_PERIOD", "DS",
            "TAB_MEASURE", "TAB_MEASURE_LABEL", "OBS_VALUE", "OBS_STATUS",
            "UNIT_MULT", "UNIT_MEASURE", "CONF_STATUS"]


def empreinte(chemin: Path) -> str:
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def telecharger() -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    dest = RAW / "comparateur.parquet"
    print(f"  téléchargement {URL}")
    with requests.get(URL, stream=True, timeout=300,
                      headers={"User-Agent": "observatoire-ncpa (GitHub Actions)"}) as r:
        r.raise_for_status()
        with dest.open("wb") as f:
            for bloc in r.iter_content(1 << 20):
                f.write(bloc)
    print(f"  {dest.stat().st_size / 1e6:.1f} Mo reçus")
    return dest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="chemin d'un fichier parquet déjà téléchargé")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    print("Base du comparateur de territoires INSEE")
    source = Path(args.local) if args.local else telecharger()
    sha = empreinte(source)

    if META.exists() and not args.force:
        ancien = json.loads(META.read_text(encoding="utf-8"))
        if ancien.get("sha256") == sha and (OUT / "epci_insee.csv").exists():
            print(f"  fichier inchangé depuis le {ancien.get('date_extraction')} : rien à faire")
            return 0

    # Lecture : seules les colonnes documentées présentes dans le fichier
    import pyarrow.parquet as pq
    schema = pq.read_schema(source).names
    absentes = [c for c in COLONNES if c not in schema]
    if absentes:
        print(f"  ATTENTION : colonnes absentes {absentes}")
        print(f"  colonnes présentes : {schema}")
    if not {"GEO", "OBS_VALUE"} <= set(schema):
        print("ERREUR : structure inattendue, ajuster COLONNES")
        return 1
    df = pd.read_parquet(source, columns=[c for c in COLONNES if c in schema])
    print(f"  {len(df):,} lignes lues".replace(",", " "))

    # Inventaire des niveaux géographiques : utile au premier passage
    if "GEO_OBJECT" in df:
        niveaux = df.groupby(["GEO_OBJECT", df.get("GEO_OBJECT_LABEL", df["GEO_OBJECT"])]).size()
        print("  niveaux géographiques :")
        for (code, lib), n in niveaux.items():
            print(f"    {code:<12} {str(lib)[:40]:<40} {n:>10,}".replace(",", " "))

    # Filtre : les EPCI du référentiel Etalab (clé SIREN), plus le niveau France
    ref = pd.read_csv(OUT / "epci_ref.csv", dtype={"siren": str})
    sirens = set(ref["siren"])
    df["GEO"] = df["GEO"].astype(str)
    est_epci = df["GEO"].isin(sirens)
    est_france = df.get("GEO_OBJECT", pd.Series("", index=df.index)).astype(str).str.upper().isin(
        {"FRANCE", "FRA", "FR", "PAYS"})
    df = df[est_epci | est_france].copy()
    df["niveau_geo"] = "EPCI"
    df.loc[est_france[df.index], "niveau_geo"] = "France"
    if SIREN_NCPA not in set(df["GEO"]):
        print("ERREUR : NCPA absente après filtrage — vérifier le format du code GEO")
        return 1

    # Valeur numérique, multiplicateur d'unité appliqué
    df["valeur"] = pd.to_numeric(df["OBS_VALUE"], errors="coerce")
    if "UNIT_MULT" in df:
        mult = pd.to_numeric(df["UNIT_MULT"], errors="coerce").fillna(0)
        df["valeur"] = df["valeur"] * (10.0 ** mult)
    df["id_mesure"] = df.get("DS", "").astype(str) + "." + df.get("TAB_MEASURE", "").astype(str)

    longue = (df.rename(columns={"GEO": "code_geo", "TIME_PERIOD": "periode",
                                 "OBS_STATUS": "statut_obs", "CONF_STATUS": "statut_conf"})
                [["code_geo", "niveau_geo", "id_mesure", "periode", "valeur", "statut_obs", "statut_conf"]]
                .sort_values(["id_mesure", "periode", "code_geo"]))

    cat = (df.groupby("id_mesure")
             .agg(ds=("DS", "first"), tab_measure=("TAB_MEASURE", "first"),
                  libelle=("TAB_MEASURE_LABEL", "first"), unite=("UNIT_MEASURE", "first"),
                  nb_epci=("GEO", "nunique"), periodes=("TIME_PERIOD", lambda s: "|".join(sorted(map(str, set(s))))))
             .reset_index())

    OUT.mkdir(parents=True, exist_ok=True)
    longue.to_csv(OUT / "epci_insee.csv", index=False, lineterminator="\n")
    cat.to_csv(OUT / "epci_mesures.csv", index=False, lineterminator="\n")
    META.write_text(json.dumps({
        "source": URL, "sha256": sha, "date_extraction": date.today().isoformat(),
        "nb_lignes": int(len(longue)), "nb_epci": int(longue.loc[longue.niveau_geo == "EPCI", "code_geo"].nunique()),
        "nb_mesures": int(len(cat))}, ensure_ascii=False, indent=2), encoding="utf-8")

    taille = (OUT / "epci_insee.csv").stat().st_size / 1e6
    print(f"  epci_insee.csv    {len(longue):>9,} lignes, {taille:.1f} Mo".replace(",", " "))
    print(f"  epci_mesures.csv  {len(cat):>9} mesures")
    if taille > 50:
        print("  ATTENTION : fichier volumineux pour Git, envisager de restreindre les mesures")
    return 0


if __name__ == "__main__":
    sys.exit(main())

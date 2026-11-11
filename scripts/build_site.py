"""
Assemble le tableau de bord en UN fichier HTML autonome : dist/index.html.

Ce même fichier est publié sur GitHub Pages et peut être téléchargé pour un usage
hors connexion (seuls les fonds de carte demandent internet).

Entrées : src/index.template.html, src/js/*.js (ordre alphabétique),
          vendor/ (MapLibre), data/processed/*.csv et *.geojson
Sortie  : dist/index.html

Usage : python scripts/build_site.py
"""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import subprocess
import sys

import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
P = RACINE / "data" / "processed"
SRC = RACINE / "src"
VENDOR = RACINE / "vendor"
DIST = RACINE / "dist"
MAPLIBRE = "maplibre-gl-5.6.0"


def donnees_communales() -> tuple[dict, dict]:
    """Reconstitue la structure attendue par le moteur JS à partir des CSV longs."""
    v = pd.read_csv(P / "valeurs_communes.csv", dtype={"code_geo": str, "scenario": str},
                    keep_default_na=False, na_values=[""])
    v["scenario"] = v["scenario"].fillna("")
    ind = pd.read_csv(P / "indicateurs.csv")
    com = pd.read_csv(P / "communes.csv", dtype={"code_insee": str})
    src = pd.read_csv(P / "sources.csv")

    series = {}
    for (i, sc), grp in v.groupby(["id_indicateur", "scenario"]):
        cle = i if not sc else f"{i}::{sc}"
        series[cle] = {c: {str(int(a)): round(float(x), 4) for a, x in zip(g.annee, g.valeur)}
                       for c, g in grp.groupby("code_geo")}

    utilises = set(v["id_indicateur"])
    indicateurs = {r.id_indicateur: {"l": r.libelle_indicateur, "u": r.unite, "t": r.thematique,
                                     "s": r.sous_theme, "src": r.code_source}
                   for r in ind.itertuples() if r.id_indicateur in utilises}
    sources_utilisees = set(v["code_source"])
    sources = {r.code_source: {"s": r.source, "p": r.producteur, "url": r.adresse}
               for r in src.itertuples() if r.code_source in sources_utilisees}

    return {
        "communes": dict(zip(com.code_insee, com.nom_commune)),
        "indicateurs": indicateurs,
        "series": series,
        "sources": sources,
        "annees": sorted(int(a) for a in v["annee"].unique()),
        "nb_valeurs": len(v),
        "epci": revenus_epci(),
    }, {r.code_insee: r.superficie_km2 for r in com.itertuples() if pd.notna(r.superficie_km2)}


def revenus_epci() -> dict:
    """Valeurs publiées pour NCPA, sans reconstitution à partir des communes."""
    fichier = P / "epci_insee.csv"
    if not fichier.exists():
        return {}
    e = pd.read_csv(fichier, dtype={"code_geo": str})
    correspondance = {"DS_FILOSOFI_CC.MED_SL": "I073", "DS_FILOSOFI_CC.PR_MD60": "I075"}
    e = e[(e.code_geo == "200065563") & (e.niveau_geo == "EPCI")
          & e.id_mesure.isin(correspondance)]
    if e.duplicated(["id_mesure", "periode"]).any():
        raise ValueError("Plusieurs valeurs INSEE pour un même revenu EPCI / millésime")
    meta = json.loads((P / "epci_insee_meta.json").read_text(encoding="utf-8"))
    resultat = {}
    for r in e.itertuples():
        if pd.notna(r.valeur):
            resultat.setdefault(correspondance[r.id_mesure], {})[str(int(r.periode))] = {
                "v": float(r.valeur), "source": meta["source"],
                "extraction": meta["date_extraction"], "mesure": r.id_mesure,
            }
    return resultat


def info_construction() -> dict:
    sha = os.environ.get("GITHUB_SHA")
    if not sha:
        try:
            sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=RACINE, capture_output=True,
                                 text=True, check=True).stdout.strip()
        except Exception:
            sha = "local"
    return {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "version": sha[:7]}


def js(obj) -> str:
    # « </ » neutralisé : une chaîne de données ne peut pas refermer la balise <script>
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def main() -> int:
    gabarit = (SRC / "index.template.html").read_text(encoding="utf-8")
    for marqueur in ("<!-- @@VENDOR_CSS@@ -->", "<!-- @@SCRIPTS@@ -->"):
        if marqueur not in gabarit:
            print(f"ERREUR : marqueur {marqueur} absent du gabarit")
            return 1

    data, superficies = donnees_communales()
    geo = json.loads((P / "communes_simpl.geojson").read_text(encoding="utf-8"))
    build = info_construction()

    css_vendor = (VENDOR / f"{MAPLIBRE}.css").read_text(encoding="utf-8")
    js_vendor = (VENDOR / f"{MAPLIBRE}.js").read_text(encoding="utf-8")
    modules = sorted((SRC / "js").glob("[0-9]*.js"))
    app = "\n".join(m.read_text(encoding="utf-8") for m in modules)

    scripts = (
        f"<script>\n/* MapLibre GL JS 5.6.0 — BSD-3-Clause */\n{js_vendor}\n</script>\n"
        "<script>\n"
        f"const DATA = {js(data)};\n"
        f"const GEO_NCPA = {js(geo)};\n"
        f"const SUPERFICIES = {js(superficies)};\n"
        f"const BUILD = {js(build)};\n"
        "</script>\n"
        f"<script>\n{app}\n"
        "document.getElementById('build-info').textContent = "
        "`Version ${BUILD.version} · construite le ${BUILD.date}`;\n"
        "</script>"
    )
    html = (gabarit
            .replace("<!-- @@VENDOR_CSS@@ -->", f"<style>\n/* MapLibre GL JS 5.6.0 */\n{css_vendor}\n</style>")
            .replace("<!-- @@SCRIPTS@@ -->", scripts))

    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(html, encoding="utf-8")
    print(f"dist/index.html : {len(html.encode()) / 1024:.0f} Ko, {len(modules)} modules, version {build['version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

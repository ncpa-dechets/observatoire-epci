# Observatoire territorial — Normandie-Cabourg-Pays d'Auge

Tableau de bord des données publiques sur les 38 communes de NCPA : démographie, logement,
construction, emploi, capacité d'accueil touristique, revenus. Une ressource partagée
pour éclairer les décisions, construite à partir de sources ouvertes et documentée pour
que chaque chiffre puisse être retracé jusqu'à son origine.

Le site est un **fichier HTML unique et autonome** : publié sur GitHub Pages, il peut aussi
être téléchargé et ouvert hors connexion (seuls les fonds de carte demandent internet).

---

## Organisation du dépôt

```
data/
  sources/              Entrées déposées à la main
    saisie_valeurs_NCPA.xlsx    classeur de saisie (Valeurs, Indicateurs, Communes, Sources)
    communes.geojson            contours communaux IGN
  processed/            Données traitées, VERSIONNÉES — format long, une ligne = une valeur
    valeurs_communes.csv        commune × année × indicateur × valeur
    indicateurs.csv, sources.csv, communes.csv (avec superficie)
    communes_simpl.geojson      contours simplifiés pour le web
    epci_ref.csv, epci_membres.csv   référentiel des 1 255 EPCI (Etalab)
    epci_insee.csv, epci_mesures.csv  base comparateur INSEE (après le 1er passage)
  raw/                  Téléchargements bruts — ignoré par Git
scripts/
  build_data.py         classeur + contours → CSV longs
  fetch_epci.py         référentiel EPCI Etalab
  fetch_insee.py        base du comparateur de territoires INSEE
  check_data.py         contrôles de cohérence, bloquants en cas d'erreur
  build_site.py         assemble dist/index.html
src/
  index.template.html   mise en page et styles
  js/                   modules du tableau de bord, chargés dans l'ordre des numéros
vendor/                 MapLibre GL JS 5.6.0, embarqué (pas de CDN)
.github/workflows/
  maj-donnees.yml       mensuel : récupère, contrôle, enregistre si changement
  publication.yml       à chaque changement : construit et publie sur Pages
```

## Principes

- **Format long, sans exception.** Une ligne = un territoire × une période × un indicateur ×
  une valeur. Les formats pivotés ne sont produits qu'au moment de l'affichage.
- **Les données traitées sont versionnées.** L'historique Git de `data/processed/` est
  l'historique des millésimes : on peut toujours retrouver ce qui était publié à une date donnée.
- **Rien n'est publié sans contrôle.** `check_data.py` vérifie les identités comptables
  (parc = RP + RS + vacants, totaux d'hébergement), les conventions d'échelle des
  pourcentages, le rattachement des contours. Une erreur bloque la publication.
- **Aucune dépendance externe au chargement.** Données, contours et bibliothèque
  cartographique sont embarqués dans le fichier.

## Travailler en local

```bash
pip install -r scripts/requirements.txt
python scripts/build_data.py     # classeur → CSV
python scripts/check_data.py     # contrôles
python scripts/build_site.py     # → dist/index.html, à ouvrir dans le navigateur
```

Pour la base EPCI (facultatif en local) :

```bash
python scripts/fetch_epci.py
python scripts/fetch_insee.py    # ou --local chemin/vers/comparateur.parquet
```

## Mettre à jour les données

- **Données communales** : remplacer `data/sources/saisie_valeurs_NCPA.xlsx` et enregistrer
  (`git commit` + `git push`). La publication se relance seule.
- **Données nationales** : automatique le 3 de chaque mois. Pour forcer :
  onglet *Actions* → *Mise à jour des données* → *Run workflow*.

## Sources et licences

| Donnée | Producteur | Licence |
|---|---|---|
| Recensement, Filosofi, comparateur de territoires, tourisme | INSEE | Licence Ouverte 2.0 |
| Sitadel2 (permis de construire) | SDES | Licence Ouverte 2.0 |
| Contours communaux, orthophotographie | IGN | Licence Ouverte 2.0 |
| Référentiel des EPCI | Etalab (d'après le COG INSEE) | Licence Ouverte 2.0 |
| Fond de carte Positron | OpenFreeMap, données © contributeurs OpenStreetMap | ODbL |
| MapLibre GL JS | MapLibre | BSD-3-Clause (`vendor/LICENSE-maplibre.txt`) |

La feuille de route est dans [`ROADMAP.md`](ROADMAP.md).

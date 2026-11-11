# Feuille de route

Cinq phases, chacune utilisable seule. Les durées sont des ordres de grandeur.

---

## Avant tout : deux décisions

- [ ] **Validation de la publication.** Un site public au nom de NCPA engage l'institution.
  À présenter à la hiérarchie comme une ressource ouverte au service des communes et des
  services, construite uniquement sur des données publiques.
- [ ] **Dépôt public ou privé.** GitHub Pages est gratuit pour un dépôt public. Pour un dépôt
  privé, il faut un abonnement payant — et le site publié reste public dans tous les cas,
  sauf avec GitHub Enterprise. Conséquence : **aucune donnée interne non publiable dans ce
  dépôt** (tonnages détaillés, données nominatives, fichiers fonciers MAJIC).

---

## Phase 0 — Mettre le socle en ligne · ≈ 1 heure

- [ ] Créer le dépôt sur GitHub (nom suggéré : `observatoire-ncpa`)
- [ ] Déposer le contenu de ce dossier et pousser sur `main`
- [ ] *Settings → Pages → Source* : choisir **GitHub Actions**
- [ ] *Settings → Actions → General → Workflow permissions* : **Read and write**
- [ ] Vérifier que *Publication du site* passe au vert et ouvrir l'adresse affichée
- [ ] Lancer à la main *Actions → Mise à jour des données → Run workflow*

## Phase 1 — Éprouver la base EPCI · ≈ une demi-journée

`fetch_insee.py` est écrit d'après la documentation INSEE, sans avoir vu le fichier réel.
Son étape est non bloquante en attendant.

- [ ] Lire dans le journal du premier passage l'inventaire des niveaux géographiques et des
      mesures ; corriger le script si la structure diffère
- [ ] Vérifier la taille de `epci_insee.csv` (alerte au-delà de 50 Mo, limite GitHub à 100 Mo
      par fichier) ; restreindre aux mesures utiles si besoin
- [ ] Retirer `continue-on-error` dans `maj-donnees.yml`
- [ ] Choisir les ~25 mesures qui serviront à la recherche de jumeaux, réparties sur les cinq
      thèmes, et les consigner dans un fichier de configuration versionné
- [ ] Ajouter la liste des communes de la loi Littoral (data.gouv.fr, *Communes de la loi
      littoral au COG*) pour un filtre littoral exact, avec un script `fetch_littoral.py`

## Phase 2 — Module « Jumeaux » · ≈ 2 à 3 jours

Nouvel onglet dans le même fichier.

- [ ] Normalisation des mesures (score z sur le périmètre de comparaison)
- [ ] Distance pondérée à NCPA, poids égaux par thème par défaut, curseurs de repondération
- [ ] Pour chaque jumeau : les indicateurs qui rapprochent et ceux qui éloignent
- [ ] Périmètres : littoral et touristique, Normandie et façades maritimes, France entière
- [ ] Position de NCPA en percentile, sur le périmètre puis en national
- [ ] Carte des EPCI colorés par ressemblance — contours EPCI à simplifier fortement
      (les 1 255 contours pèseraient plusieurs Mo : arbitrer entre fichier unique et
      chargement à la demande depuis Pages)

## Phase 3 — Sortir progressivement du classeur manuel · au fil de l'eau

Le classeur reste l'interface de saisie tant que c'est utile ; chaque source automatisée
en sort une partie.

- [ ] Explorer l'API Melodi de l'INSEE : les jeux de données du comparateur en sont issus,
      et une requête ciblée remplacerait le téléchargement du fichier complet
- [ ] Automatiser source par source, de la plus fréquente à la plus rare : Sitadel (mensuel),
      offre touristique (annuel), recensement (annuel), Filosofi
- [ ] À terme, faire des CSV longs la source de vérité et du classeur une simple vue

## Phase 4 — Robustesse et méthode · continu

- [ ] **Double dénominateur** : afficher les ratios par habitant permanent ET par population
      présente estimée. Les proxys internes (tonnages, taxe de séjour) restent hors du dépôt
      public ; seuls les ratios agrégés publiables y entrent
- [ ] Étiqueter chaque millésime publié (`git tag v2026.09`) et tenir un journal des changements
- [ ] Test automatique du rendu (ouverture de chaque onglet dans un navigateur sans écran,
      échec si erreur JavaScript)
- [ ] Domaine personnalisé si l'observatoire est validé

---

## Pièges connus

- **Un commit fait par GitHub Actions ne déclenche pas d'autre workflow.** D'où le
  déclencheur `workflow_run` dans `publication.yml` : ne pas le retirer.
- **Les workflows planifiés sont désactivés après 60 jours sans activité** sur un dépôt
  public. Si aucune donnée ne change pendant deux mois, réactiver depuis l'onglet Actions.
- **Les URL de l'INSEE peuvent changer d'une édition à l'autre.** Elles sont regroupées en
  tête de chaque script.
- **La version du référentiel Etalab est figée** (`fetch_epci.py`). La monter chaque année
  après la publication du nouveau Code officiel géographique, en janvier.
- **Le classeur Excel est binaire** : ses modifications sont illisibles dans Git. Les CSV de
  `data/processed/` servent de trace lisible de ce qui a changé.

## Calendrier indicatif des sources

À confirmer pour chaque édition : les dates de l'INSEE varient d'une année sur l'autre.

| Source | Rythme | Période habituelle |
|---|---|---|
| Code officiel géographique | annuel | janvier |
| Offre d'hébergement touristique | annuel | début d'année |
| Recensement de la population | annuel | fin juin |
| Base du comparateur de territoires | annuel | septembre |
| Filosofi | annuel | variable |
| Sitadel | mensuel | fin de mois |

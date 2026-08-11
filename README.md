[![ActivityPods](https://badgen.net/badge/Powered%20by/ActivityPods/28CDFB)](https://activitypods.org)

# La Carte des Savoirs

Partagez vos savoirs et compétences avec votre réseau, sur une carte géographique. Chacun déclare
les compétences qu'il maîtrise (avec son niveau — "Débutant" y compris, c'est important !) et
apparaît sur la carte pour ses contacts.

Réécriture complète de l'application originale (react-admin / ActivityPods 1.x, conservée sur la
branche [`0.1.x`](../../tree/0.1.x)) pour ActivityPods 2.x, avec :

- [Refine](https://refine.dev/) + [Ant Design](https://ant.design/) côté frontend, via
  [`@activitypods/refine-providers`](https://github.com/activitypods/refine-providers)
- [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/) pour la carte
- [PAIR](https://virtual-assembly.org/ontologies/pair-2021-summer/index-en.html) comme ontologie
  pour les compétences (`pair:ExperienceAssociation`, `pair:Skill`, `pair:Grade`)
- un petit backend Moleculer ([`@activitypods/app`](https://github.com/activitypods/activitypods))
  qui sert les catalogues de compétences/niveaux et déclare les besoins d'accès de l'application

## Architecture

```
backend/    Moleculer + @activitypods/app
frontend/   Vite + React + TypeScript + Refine + Antd + @activitypods/refine-providers
```

Deux choix d'architecture notables, détaillés dans les commentaires du code (voir notamment
`backend/services/experience.service.js` et `frontend/src/hooks/useNetworkSkills.ts`) :

- Les compétences (et l'adresse, une fois consentie) sont **publiques en lecture** plutôt que
  partagées individuellement par contact via le mécanisme SAI habituel — ça évite d'avoir à
  ré-partager automatiquement à chaque nouveau contact. La confidentialité pratique vient du fait
  que l'application ne présente jamais que les contacts de l'utilisateur connecté.
- Les compétences d'un contact sont retrouvées via `getList('profile')` (qui reflète nativement
  les profils visibles par l'utilisateur connecté) puis le prédicat `pair:hasExperience` posé sur
  chaque profil — sans service d'agrégation/miroir dédié côté backend.

## Prérequis

- Un token d'accès Mapbox : <https://docs.mapbox.com/help/getting-started/access-tokens/>

Le shape tree `pair:ExperienceAssociation` est déployé sur
<https://shapes.activitypods.org/shapetrees/pair/ExperienceAssociation> (voir la PR mergée dans
[`activitypods/shapes`](https://github.com/activitypods/shapes)) — rien à lancer localement pour
ça.

## Développement

1. Copiez `.env` en `.env.local` à la racine et renseignez `MAPBOX_ACCESS_TOKEN`.
2. Démarrez le pod provider de développement (fuseki, activitypods, redis, arena) :
   ```bash
   make start
   ```
3. Copiez `backend/.env` en `backend/.env.local` si vous voulez surcharger des valeurs, puis :
   ```bash
   cd backend && yarn install && yarn dev
   ```
4. Copiez `frontend/.env` en `frontend/.env.local`, renseignez `VITE_MAPBOX_ACCESS_TOKEN`, puis :
   ```bash
   cd frontend && yarn install && yarn dev
   ```
5. Ouvrez <http://localhost:4001>, connectez-vous avec le pod provider local
   (<http://localhost:3000>), ajoutez vos premières compétences.

Pour tester le réseau (compétences visibles entre contacts), créez un deuxième compte sur le pod
provider local, mettez les deux comptes en contact via son interface ("Mon réseau"), puis
connectez-vous avec chacun dans deux navigateurs (ou fenêtres de navigation privée) différents.

### Commandes utiles

`make start` Démarre le pod provider de développement (docker-compose).

`make stop` Arrête et supprime les conteneurs du pod provider de développement.

`make logs-activitypods` Affiche les logs du pod provider.

`make attach-activitypods` Ouvre le REPL Moleculer du pod provider.

`cd backend && yarn dev` Démarre le backend de l'application (avec REPL Moleculer et hot-reload).

## Production

`make build-prod` Construit les images Docker pour la production (inclut un reverse-proxy Traefik).

`make start-prod` Démarre les conteneurs de production.

`make stop-prod` Arrête et supprime les conteneurs de production.

Voir `.env.production` pour les variables à renseigner (domaine, mot de passe Fuseki, token
Mapbox...).

## Modèle de données

- `pair:Skill` : catalogue de compétences (catégories + compétences précises, hiérarchie à 2
  niveaux via `skos:broader`), hébergé publiquement par notre backend et seedé depuis
  `backend/services/importers/data/skills-catalog-fr.json`.
- `pair:Grade` : les 4 niveaux (Débutant, Intermédiaire, Confirmé, Expert), même mécanisme.
- `pair:ExperienceAssociation` : une compétence déclarée par un utilisateur dans son propre Pod
  (`pair:experienceSkill` + `pair:experienceGrade`, tous deux des références vers les catalogues
  ci-dessus, + `as:summary` optionnel). Rendue publique en lecture à la création, et référencée
  depuis le profil de l'utilisateur (`pair:hasExperience`) pour que ses contacts puissent la
  retrouver — voir `backend/services/experience.service.js`.
- `vcard:Location` : l'adresse du domicile, ajoutée/modifiée directement dans l'app (voir
  `frontend/src/components/AddressEditor.tsx`) — visible aussi depuis le gestionnaire de
  porte-données. Rendue publique en lecture à la création, même mécanisme que les compétences —
  voir `backend/services/location.service.js`. Le consentement est demandé une seule fois, avant
  la première saisie.

Les recommandations entre pairs ne sont pas encore implémentées dans cette version.

## Licence

Apache-2.0

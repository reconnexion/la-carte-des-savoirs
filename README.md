[![ActivityPods](https://badgen.net/badge/Powered%20by/ActivityPods/28CDFB)](https://activitypods.org)

# La Carte des Savoirs

Partagez vos savoirs avec votre réseau, sur une carte géographique. Chacun déclare
les savoirs qu'il maîtrise (avec son niveau — "Débutant" y compris, c'est important !) et
apparaît sur la carte pour ses contacts.

Réécriture complète de l'application originale (react-admin / ActivityPods 1.x, conservée sur la
branche [`0.1.x`](../../tree/0.1.x)) pour ActivityPods 2.x, avec :

- [Refine](https://refine.dev/) + [Ant Design](https://ant.design/) côté frontend, via
  [`@activitypods/refine-providers`](https://github.com/activitypods/refine-providers)
- [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/) pour la carte
- [PAIR](https://virtual-assembly.org/ontologies/pair-2021-summer/index-en.html) comme ontologie
  pour les savoirs (`pair:ExperienceAssociation`, `pair:Skill`, `pair:Grade`)
- un petit backend Moleculer ([`@activitypods/app`](https://github.com/activitypods/activitypods))
  qui sert les catalogues de savoirs/niveaux et déclare les besoins d'accès de l'application

## Architecture

```
backend/    Moleculer + @activitypods/app
frontend/   Vite + React + TypeScript + Refine + Antd + @activitypods/refine-providers
```

Deux choix d'architecture notables, détaillés dans les commentaires du code (voir notamment
`backend/services/experience.service.js` et `frontend/src/hooks/useNetworkSkills.ts`) :

- Les savoirs (et l'adresse, une fois consentie) sont **publics en lecture** plutôt que
  partagés individuellement par contact via le mécanisme SAI habituel — ça évite d'avoir à
  ré-partager automatiquement à chaque nouveau contact. La confidentialité pratique vient du fait
  que l'application ne présente jamais que les contacts de l'utilisateur connecté.
- Les savoirs d'un contact sont retrouvés via `getList('profile')` (qui reflète nativement
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
   Le backend cible un Pod provider ActivityPods **2.3** (branche `next`) : `@activitypods/app` doit
   être en 2.3.x et `@semapps/*` en 1.2.x, les 2.2/1.1 publiés attendent encore les `interop:DataGrant`
   que 2.3 a supprimés (sinon l'enregistrement de l'app échoue silencieusement côté backend et le
   frontend affiche « L'application n'écoute pas … »). Pour développer sur le framework lui-même,
   `yarn link-packages` lie `@activitypods/app` à `activitypods/app-framework/app` (`yarn link` lancé
   là-bas au préalable) ; ce dépôt étant en TypeScript, `yarn dev` passe par `tsx`. Retour aux paquets
   npm : `yarn unlink-packages`.
4. Copiez `frontend/.env` en `frontend/.env.local`, renseignez `VITE_MAPBOX_ACCESS_TOKEN`, puis :
   ```bash
   cd frontend && yarn install && yarn dev
   ```
5. Ouvrez <http://localhost:4001>, connectez-vous avec le pod provider local
   (<http://localhost:3000>), ajoutez vos premiers savoirs.

Pour tester le réseau (savoirs visibles entre contacts), créez un deuxième compte sur le pod
provider local, mettez les deux comptes en contact via son interface ("Mon réseau"), puis
connectez-vous avec chacun dans deux navigateurs (ou fenêtres de navigation privée) différents.

### Commandes utiles

`make start` Démarre le pod provider de développement (docker-compose).

`make stop` Arrête et supprime les conteneurs du pod provider de développement.

`make logs-activitypods` Affiche les logs du pod provider.

`make attach-activitypods` Ouvre le REPL Moleculer du pod provider.

`cd backend && yarn dev` Démarre le backend de l'application (avec REPL Moleculer et hot-reload).

## Environnement de dev et previews de pull requests (Coolify)

L'instance de dev et une preview par pull request sont construites et lancées par [Coolify](https://coolify.io) directement depuis ce dépôt, à partir de [`docker-compose.coolify.yml`](./docker-compose.coolify.yml) et des Dockerfiles de [`/docker`](./docker). GitHub Actions ne construit plus d'image pour elles (le workflow ne construit que les images de release, sur les tags `v*`).

Côté Coolify (serveur `test-server`, qui héberge et construit toutes les instances `dev.*`) :

- Une **application** (build pack _Docker Compose_, fichier `/docker-compose.coolify.yml`) suit la branche `master` et sert [dev.la-carte-des-savoirs.com](https://dev.la-carte-des-savoirs.com) : chaque push sur `master` la reconstruit et la redéploie.
- Les **preview deployments** sont activés : ouvrir ou mettre à jour une pull request vers `master` construit une stack séparée sur son propre domaine (`lcds-pr-<n>.dev.reconnexion.coop`, voir le _Preview URL Template_ de l'application), supprimée à la fermeture ou au merge de la PR. La GitHub App ajoute un commentaire avec le lien sur chaque PR. Seules les PR dont l'auteur est collaborateur **direct** du dépôt ont une preview (les previews publiques sont désactivées, le dépôt étant public).
- Les stacks partagent le Fuseki du service `shared-infra`, mais chacune a ses propres datasets, nommés d'après la stack (`lacartedessavoirs-backend-pr-<n>` pour les previews) ; l'instance de dev garde ses datasets historiques `lacartedessavoirs-dev` / `settings-lacartedessavoirs-dev` grâce aux variables `MAIN_DATASET` / `SETTINGS_DATASET`, définies uniquement dans le scope production. Chaque stack a aussi son propre Redis. Seul le backend rejoint le réseau partagé `coolify`.
- Les URLs du frontend sont inlinées par Vite au build : le compose passe donc le domaine généré par Coolify pour la stack (`SERVICE_FQDN_*`) en argument de build. Les variables à définir dans Coolify (`SPARQL_ENDPOINT`, `JENA_PASSWORD`, `POD_PROVIDER_BASE_URL`...) sont listées en tête du compose ; elles doivent l'être dans le scope production **et** dans le scope preview.
- Au premier démarrage, le backend enregistre son propre acteur (`/api/app`) dans son dataset de settings, avec le domaine qu'il a à ce moment-là. Les domaines doivent donc être définis dans Coolify **avant** le premier déploiement ; s'ils changent ensuite, il faut supprimer les datasets de la stack dans Fuseki et redéployer, sinon le backend refuse de démarrer (`Remote resource ... cannot be modified`).

Fermer une PR supprime ses conteneurs mais pas ses datasets Fuseki : un cron nocturne sur le serveur Coolify (`cleanup-preview-datasets.sh` dans le dépôt `shared-infra`) supprime les datasets `*-pr-<n>` qu'aucun conteneur ne déclare plus.

Les builds tournent sur le serveur Coolify : l'image du frontend plafonne le tas de Node (`NODE_OPTIONS` dans `docker/frontend.dockerfile`) pour qu'un build ne puisse pas affamer les autres conteneurs, Fuseki en particulier.

## Production

`make build-prod` Construit les images Docker pour la production (inclut un reverse-proxy Traefik).

`make start-prod` Démarre les conteneurs de production.

`make stop-prod` Arrête et supprime les conteneurs de production.

Voir `.env.production` pour les variables à renseigner (domaine, mot de passe Fuseki, token
Mapbox...).

## Modèle de données

- `pair:Skill` : catalogue de savoirs (catégories + savoirs précis, hiérarchie à 2
  niveaux via `skos:broader`), hébergé publiquement par notre backend et seedé depuis
  `backend/services/importers/data/skills-catalog-fr.json`.
- `pair:Grade` : les 4 niveaux (Débutant, Intermédiaire, Confirmé, Expert), même mécanisme.
- `pair:ExperienceAssociation` : un savoir déclaré par un utilisateur dans son propre Pod
  (`pair:experienceSkill` + `pair:experienceGrade`, tous deux des références vers les catalogues
  ci-dessus, + `as:summary` optionnel). Rendue publique en lecture à la création, et référencée
  depuis le profil de l'utilisateur (`pair:hasExperience`) pour que ses contacts puissent la
  retrouver — voir `backend/services/experience.service.js`.
- `vcard:Location` : l'adresse du domicile, ajoutée/modifiée directement dans l'app (voir
  `frontend/src/components/AddressEditor.tsx`) — visible aussi depuis le gestionnaire de
  porte-données. Contrairement aux savoirs, cette ressource reste **privée** (ses détails —
  rue, code postal... — ne sont jamais exposés par l'application) : seule sa position géographique
  (`vcard:hasGeo`) est recopiée sur le profil de l'utilisateur, déjà visible nativement par ses
  contacts, sans action de partage supplémentaire. Cette recopie est gérée nativement par le pod
  provider lui-même (hook `before.put` sur le profil, voir `pod-provider/backend/services/profiles/
  profile.ts` dans le dépôt ActivityPods) dès que le profil est mis à jour (PUT) avec
  `vcard:hasAddress` renseigné — l'app n'a donc aucun code spécifique à écrire pour ça. Le
  consentement est demandé une seule fois, avant la première saisie.

Les recommandations entre pairs ne sont pas encore implémentées dans cette version.

## Licence

Apache-2.0

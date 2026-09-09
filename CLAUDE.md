# MauriExplore / Trip4mauritius

PWA marketplace touristique pour l'île Maurice. Touristes réservent des activités, opérateurs locaux les publient, Trip4mauritius tient le catalogue depuis son back-office. **Il n'y a pas de modération** : voir le lot 13.

**Plan de référence : [docs/BACKEND-PLAN.md](docs/BACKEND-PLAN.md)** — le lire avant toute tâche backend.
**Usage du site, rôle par rôle : [docs/GUIDE-UTILISATION.md](docs/GUIDE-UTILISATION.md).**

## Stack

Next.js 16 (App Router, runtime **Node.js** — jamais Edge) · tRPC v11 · Prisma **7.10.0** · Neon Postgres 18 (eu-central-1) · Better Auth · Zod · Tailwind v4 · déployé sur Vercel.

## Architecture

```
server/services/     logique métier — écrite UNE fois, consommée par les RSC
                     ET par les routers tRPC
server/trpc/         init (contexte + 4 procédures), root, routers
server/mappers/      conversion base → types front (point unique)
lib/db.ts            client Prisma singleton + driver adapter
lib/auth.ts          Better Auth
lib/datetime.ts      fuseau Maurice
types/               contrat de sortie : Activity, ActivityFull, Booking…
```

**Deux surfaces** : tRPC pour ce que le front appelle ; Route Handlers nus pour les entrées machine (webhook Stripe, cron) — la vérification de signature exige le corps brut, incompatible avec tRPC.

**Rendu hybride** : `/`, `/activities`, `/activities/[slug]` sont rendus côté serveur (contenu indexable). Le reste est client + tRPC.

## Règles à ne pas enfreindre

- **`prisma db push` est interdit.** Les contraintes `CHECK` sont écrites à la main dans le SQL des migrations ; `db push` les supprimerait en silence et rendrait la survente possible.
- ⚠️ **`prisma migrate dev` est inutilisable sur ce projet** (constaté le 09/09/2026). Le checksum de `20260902120000_add_categories` diverge de ce qui a été appliqué : `migrate dev` — **même avec `--create-only`** — répond « The migration was modified after it was applied. We need to reset the "public" schema… All data will be lost ». Or cette base est celle que sert le site (voir ci-dessous). `migrate status`, lui, affiche « up to date » et ne signale rien. **Écrire les nouvelles migrations À LA MAIN** (`prisma/migrations/AAAAMMJJHHMMSS_nom/migration.sql`) et les appliquer par **`prisma migrate deploy`**, qui ne reset jamais et ignore la divergence de checksum — c'est déjà ce que lance `npm run build`.
- ⚠️ **Depuis le 07/09/2026, le site en ligne pointe sur la branche `dev`.** Les variables `DATABASE_URL` et `DATABASE_URL_UNPOOLED` de production Vercel ont été basculées sur l'endpoint `ep-polished-mouse-b2n8pcje`. **Le cloisonnement dev/prod n'existe donc plus** : `npm run db:seed`, `prisma migrate dev` et `migrate reset` lancés en local écrivent désormais dans la base que servent les visiteurs. La branche `production` (`br-winter-rice-b2ctx6se`, endpoint `ep-wild-unit-b23f1j9r`) est intacte et reste le chemin de retour.
- **Le `.env` local pointe sur la branche Neon `dev`** — la même que la production, voir ci-dessus. `migrate reset` est destructif. Le seed, lui, ne l'est pas — tout y passe par `upsert`, et le catalogue est en `update: {}`, donc **relancer le seed ne restaure rien** — mais il réécrit sans condition le mot de passe et le rôle des 6 comptes prédéfinis. Le pointer sur la production y poserait le mot de passe public.
- **Tout horaire d'activité se formate via `lib/datetime.ts`** (`Indian/Mauritius`, UTC+4, sans DST). Le fuseau du navigateur afficherait un départ de 09:00 à 07:00 pour un touriste à Paris.
- **La base stocke `spotsTaken`, le front lit `spotsLeft`.** Conversion uniquement dans `server/mappers/`.
- **Les prix se recalculent côté serveur**, jamais depuis la requête client. Zod valide la forme, pas la véracité. Le calcul 20/80 (RULE-001) vit dans `lib/pricing.ts`, en centimes entiers, et sert **aussi** à l'affichage client — deux implémentations divergeraient au premier arrondi.
- **Le panier vit dans le navigateur** (`lib/stores/cart.ts`, Zustand + localStorage), pas en base. Tout ce qu'il contient est modifiable par l'utilisateur : `booking.create` ne reçoit que `slotId` + `participants`, jamais un montant.
- **Toute écriture concurrente sur un créneau passe par un UPDATE conditionnel atomique**, jamais par un read-then-write. Même schéma pour l'annulation (`updateMany` gardé sur le statut).
- **Les activités à la journée n'ont pas de compteur** : leur disponibilité se calcule en comptant les réservations actives dont la période **chevauche** celle demandée, contre `Activity.dailyUnits`. Un compteur ne saurait pas dire qu'une Jeep louée du 12 au 14 reste libre le 20. Ce comptage est un read-then-write, il n'est donc légitime que **sous un `SELECT … FOR UPDATE`** sur la ligne de l'activité, pris **avant** toute lecture — `dailyUnits` compris. Sans lui, six réservations simultanées passent toutes (vérifié : le test `ne loue pas deux fois la même voiture` échoue à `6` quand on retire le verrou).
- **Les lignes de panier sont triées par une clé de verrouillage préfixée** (`daily:<activityId>` / `slot:<slotId>`, cf. `lockKey`), et non plus par `slotId` seul. Avec deux tables cibles, il faut un ordre **total** commun à toutes les transactions : sans lui, deux paniers croisés s'interbloquent.
- **`dailyUnits` n'est PAS `maxParticipants`.** Le premier est le nombre de véhicules, le second le nombre de places dans un véhicule. Les confondre revient à louer la même voiture à quatre clients.
- **Tout router `operator` filtre par `ctx.operator.id`**, y compris en lecture par id.
- **Les écritures de catalogue non filtrées vivent dans `server/services/admin-catalog.ts`, jamais dans `operator.ts`.** C'est l'exact inverse de la règle ci-dessus, et c'est voulu : le back-office édite la fiche de n'importe quel opérateur. Les mettre dans le même fichier poserait, côte à côte, des requêtes filtrées et des requêtes ouvertes — et le prochain copier-coller prendrait la mauvaise. Le statut se pose par `setActivityStatus`. Depuis le lot 13, l'espace opérateur suit la même règle : modifier une fiche publiée ne change plus son statut, faute de file d'attente où la renvoyer.
- **`ActivityStatus` n'a que TROIS états : `draft`, `published`, `archived`.** `pending_moderation` et `rejected` ont été retirés de l'énumération Postgres (migration `20260909160000`), pas seulement des écrans : c'étaient les deux états de la file de modération, supprimée au lot 13, et plus aucun chemin d'écriture ne les posait depuis. Une valeur d'énumération que rien ne produit est une fonctionnalité fantôme — elle se relit un an plus tard comme la preuve qu'une modération existe. Corollaire : `AdminActivityStatus` est aujourd'hui **égal** à `ActivityStatus`, l'admin pouvant poser les trois depuis `/admin/activities`. Les deux listes restent néanmoins déclarées séparément — « ce que la colonne peut contenir » et « ce qu'un humain peut poser » sont deux questions, et leur égalité est un fait, pas une règle.
- **`bookingMode` est sur `OperatorActivitySummary`, pas seulement sur le détail.** La garde de publication en dépend, et les listings grisent « En ligne » sur `slotCount`/`upcomingSlots` : sans le mode sur la ligne, les **10 locations à la journée du lot B3 étaient impubliables depuis le back-office** — le service les acceptait (`assertPublishable` fait l'exception), mais le bouton ne partait jamais. C'est le même bug que celui du lot B1, déplacé du serveur vers le client. Tout écran qui conditionne la publication à des créneaux doit lire `bookingMode` d'abord.
- **La garde de publication dépend du mode de vente et vit dans `assertPublishable` (`server/services/activity-write.ts`)** — un seul endroit pour les deux surfaces qui publient (`publishOwnActivity` et `setActivityStatusForAdmin`). Elle n'exige un créneau à venir qu'en mode `slot` : une activité à la journée n'en a aucun, par construction, et la règle recopiée des créneaux la rendait **impubliable pour toujours**. Toute vérification de publication doit être testée par le VRAI chemin : c'est un `status: 'published'` écrit directement en base, dans une fixture, qui avait masqué ce blocage — `tsc` et les 141 tests passaient.
- **`role` est en `input: false`** dans Better Auth — sinon on pourrait s'inscrire admin. Le formulaire d'inscription ne propose donc aucun choix de rôle : tout le monde s'inscrit `tourist`.
- **`server/services/admin.ts` est le SEUL fichier qui écrit `User.role`**, et il ne sait fabriquer ni admin ni super admin : les deux viennent du seed. `admin.createOperator` est le seul chemin vers le rôle `operator` — l'auto-inscription a disparu au lot 13, elle aurait été un endpoint d'auto-promotion.
- **La description d'activité n'exige que le français.** Les traductions manquantes sont comblées à la lecture par `toDescription` (`server/mappers/activity.ts`). Exiger les 5 langues à l'écriture poussait à coller cinq fois le même texte, et la base ne distinguait plus une traduction d'un copier-coller.
- **Les images d'activité sont des URLs**, pas des fichiers : `data:` est explicitement refusé par le schéma. Un base64 dans `imageUrls` serait relu à chaque affichage du catalogue.
- **La protection des routes vit dans `proxy.ts`** (`middleware.ts` est déprécié en Next 16 ; le proxy tourne sur le runtime Node). Elle ne lit qu'un cookie : c'est du confort d'UX, **l'autorisation reste dans les procédures tRPC**.
- **Le service worker (`public/sw.js`) ne met en cache que des ressources publiques et immuables** — `/_next/static/*` et les médias. `/api/` n'est pas intercepté et aucune page HTML n'est stockée : ces réponses dépendent de la session, et les écrire sur le disque les rendrait lisibles hors ligne par l'utilisateur suivant d'un appareil partagé. Changer le cache impose de bumper `CACHE_NAME` (c'est `activate` qui purge les anciens).
- **Les guides ont leur PROPRE classification** (`guide_categories`), séparée de celle des activités. « Stationnement » n'a rien à faire dans les filtres du catalogue, et renommer « Nature » côté activités ne doit pas toucher aux articles. Même grammaire cependant : slug immuable, désactivation au lieu de suppression, le front affiche le libellé et filtre sur le slug.
- **Régions et durées sont des listes FERMÉES** (`lib/regions.ts`, `lib/durations.ts`), déclarées une fois et imposées à l'écriture par `activityInputSchema`. Même règle que les catégories, née du même bug en pire : le tiroir de filtres proposait `Nord/Sud/Est/Ouest` quand la base stocke `North/South/East/West`, et trois écrans portaient trois listes de durées inconciliables (`Full day` côté seed, `3 hours` côté formulaire opérateur, `Demi-journée` côté filtres). Pour les régions on **affiche `label`, on filtre sur `value`** — `value` vit dans l'URL des recherches partagées, il ne bouge plus. Pour les durées, la valeur stockée est le français, et c'est aussi le libellé.
- **La recherche par mot-clé (`q`) porte sur le titre, la région et le libellé de catégorie**, jamais sur la description : celle-ci est un `Json` multilingue que Postgres ne parcourt pas en `contains`. Le prédicat vit dans `keywordMatch` (`server/services/activity.ts`) et sert **à la fois** la page de résultats et les suggestions de la barre — deux prédicats séparés finiraient par suggérer ce que la page ne trouve pas. `q` doit survivre à `filtersToSearchParams` **et** à `filtersKey` dans `ActivitiesClient` — l'omettre de la première l'efface de la barre d'adresse au premier rendu, l'omettre de la seconde sert un résultat en cache pour un autre mot-clé.
- **Les catégories sont une TABLE, pas un texte libre.** `lib/features.ts` pour les flags, `server/services/category.ts` pour les catégories : dans les deux cas, une seule source. Le front **affiche `category` (libellé)** et **filtre sur `categorySlug`** — les confondre est précisément ce qui cassait le catalogue (trois listes en dur divergentes, vignettes d'accueil sans résultat). Le **slug n'est jamais modifiable** après création : il vit dans l'URL des recherches partagées et indexées. Toute lecture d'activité doit inclure `category` — le type `DbActivityWithCategory` le rend impossible à oublier.
- **Un interrupteur de fonctionnalité n'est pas une autorisation.** Les flags sont déclarés dans `lib/features.ts` (source unique) et résolus en cascade *défaut ← variable d'environnement ← base*. Masquer un écran avec `useFeature` ne ferme rien : toute fonctionnalité qu'on prétend désactiver doit **aussi** passer par `withFeature()` dans sa procédure tRPC — même raisonnement que `proxy.ts`. Les flags voyagent du layout racine vers le client en props (`FeatureProvider`), jamais par une requête client : sinon l'écran scintille et chaque page paie un aller-retour.
- **Une grille responsive déclare TOUJOURS `grid-cols-1`, pas seulement `md:grid-cols-N`.** Sans template, une grille n'a qu'une colonne `auto` — dimensionnée au *max-content* de son élément le plus large, sans jamais descendre en dessous. Sur `/admin/operators`, le `<select>` d'indicatif de `PhoneInput` (large comme sa plus longue option) et les phrases d'aide portaient la colonne à 575 px : **la page défilait horizontalement sur 607 px pour un écran de 375**. `grid-cols-1` vaut `repeat(1, minmax(0, 1fr))`, et c'est le `0` qui autorise la descente. C'est le **troisième** avatar du même piège `min-width: auto` — après la fourchette de prix du catalogue et la barre d'onglets de `app/admin/layout.tsx`. Le symptôme se mesure, il ne se devine pas : `document.documentElement.scrollWidth > innerWidth` à 375 px.
- **Un composant qui vit dans un panneau étroit se replie par `flex-wrap`, pas par un `sm:`.** Les préfixes de Tailwind interrogent la **fenêtre**, jamais la boîte qui contient réellement le texte. `SlotSelector` est rendu par `BookingPanel` dans une colonne de **386 px** : à 1280 de large, donc bien au-delà de `sm`, « 09:00 – 17:00 » (212 px de date + plage) recouvrait « 20 places » (183 px de contrôles) — 411 px demandés pour 386. Une ligne `flex flex-wrap` + `ml-auto` sur le second bloc se replie sur la largeur disponible, quelle que soit celle de l'écran. Corollaire de la règle précédente : la mesure se prend **sur la ligne** (`element.scrollWidth > element.clientWidth`), pas seulement sur `document.documentElement` — la page ne débordait pas, elle se chevauchait.
- **Après un changement de schéma, lancer `prisma generate`** : `next build` ne le fait pas.

## Commandes

```bash
npm run dev            # développement
npm run build          # prisma migrate deploy && next build
npm run db:migrate     # prisma migrate dev
npm run db:seed        # seed (branche dev uniquement)
npm run db:studio
npm test               # vitest — les tests d'intégration visent la branche dev
npx tsc --noEmit       # le projet doit typechecker proprement
npx vercel ...         # le CLI n'est pas installé globalement
```

⚠️ `npm run lint` est un **script mort** : eslint n'est pas installé. Il est donc absent de la CI.

⚠️ **Ne pas lancer le serveur avec `bun --bun run dev`.** Le binaire `next` porte un shebang `#!/usr/bin/env node` ; `--bun` l'écrase et exécute Next sous le runtime **Bun**, alors que tout le projet vise Node. Le symptôme est la boucle `Error handling upgrade request TypeError: undefined is not an object (evaluating 'message')` dans `abortHandshake` — c'est le WebSocket de HMR qui échoue, donc le rechargement à chaud qui cesse de fonctionner et les modifications qui n'apparaissent plus. (Le libellé « undefined is not an object » est du JavaScriptCore : c'est Bun qui parle, pas V8.) `bun run dev` **sans** `--bun` respecte le shebang et repasse par Node — la rapidité de bun comme lanceur de scripts, sans le changement de runtime.

## Intégration continue

`.github/workflows/ci.yml` — sur chaque PR et sur `main` : `tsc --noEmit`, `prisma migrate deploy`, `npm test`.

Les tests d'intégration y visent un **Postgres jetable lancé dans le runner** (`postgres:18-alpine`), pas une branche Neon. Ils ne dépendent d'aucune fonctionnalité Neon — seulement des CHECK et de la séquence créés par le SQL des migrations. D'où : aucun secret de base en CI, et deux PR simultanées ne peuvent plus s'écraser sur les mêmes tables. En local, `npm test` continue de viser la branche `dev` via `.env`.

## État d'avancement

| Lot | État |
|---|---|
| 1 · Fondations Prisma | ✅ 9 contraintes CHECK en base |
| 2 · Seed | ✅ 22 activités, 504 créneaux, 6 comptes prédéfinis — mot de passe en clair dans `seed.ts`, `SEED_PASSWORD` reprend la main |
| 3 · Services + tRPC | ✅ |
| 4 · Lecture publique (RSC) | ✅ vérifié en production |
| 5 · Auth | ✅ email/mot de passe branché, `proxy.ts` en place — **Google et magic link écartés** |
| 6 · Réservation | ✅ création, annulation, panier Zustand — 14 tests verts dont la concurrence |
| 7 · Espace opérateur | ✅ CRUD, créneaux, cloisonnement vérifié par tests |
| 8 · Admin | ✅ modération, validation des opérateurs, révocation |
| 9 · Interrupteurs de fonctionnalité | ✅ registre, cascade, garde-fou tRPC, écran `/admin/features` |
| 10 · Catégories | ✅ table + CRUD admin `/admin/categories`, trois listes en dur supprimées |
| 11 · Back-office | ✅ listing des réservations (deux contacts par ligne), filtrable par statut et par période |
| 12 · Catalogue admin | ✅ `/admin/activities` — l'admin saisit et corrige les fiches de n'importe quel opérateur |
| 13 · Lot 1 sans modération | ✅ modération et gestion de comptes retirées, opérateurs créés par l'admin, rôle `superadmin` (Kled) pour les interrupteurs |
| 14 · Guides éditoriaux | ✅ articles Markdown + images, classification administrable, `/guide` et `/guide/[slug]` |
| 15 · Recherche, guides 100 % administrables, envoi de photos | ✅ filtre `q` de bout en bout, vocabulaires unifiés, blocs figés du guide migrés en articles, upload Vercel Blob |
| 16 · Cycle de vie des opérateurs | ✅ édition complète, suppression si vierge, désactivation sinon (`Operator.active`) |
| 17 · Deux modes de vente — B1, le socle | ✅ schéma, disponibilité par chevauchement sous verrou, tarification au jour |
| 17 · B2, le tunnel public | ✅ `bookingMode` exposé au front, `PeriodSelector` (react-day-picker), panier à clé de ligne composite, `/checkout` aiguille sur le mode. Vérifié dans le navigateur : 12→14 = 3 jours = 450 €, inchangé à 4 occupants |
| 17 · B3, la bascule des véhicules | ✅ les **10** locations du seed (pas 7) sont en mode journée, stock 1 chacune, par `updateActivityForAdmin` |

**158 tests verts** (`npm test`) : concurrence, RULE-001, annulation, cloisonnement opérateur, fuseau, modération, cascade des flags, catégories, cloisonnement des listings, écarts du catalogue admin, recherche par mot-clé, vocabulaire de filtrage, cycle de vie des opérateurs, publication des deux modes de vente, clé de ligne du panier et heure de fin dérivée.

- **Le panier n'est PAS clé par `slotId`** : une location à la journée n'en a pas. `CartItem` est une union discriminée sur `mode`, jumelle de `bookingLineSchema`, et l'identité d'une ligne se lit par `cartItemKey` (`lib/cart-lines.ts`) — préfixée par le mode, période comprise en mode journée, faute de quoi louer la même Jeep sur deux semaines différentes écraserait silencieusement la première. `cartItemUnits`, à côté, porte **seule** la règle de tarification des deux modes : personnes sur un créneau, **jours** sur une location. Ces deux fonctions vivent hors du store Zustand exprès — le store est `'use client'` et s'instancie à l'import, donc intestable sans `localStorage`.
- **Le prix journée est FORFAITAIRE** (confirmé le 09/09/2026) : 2 jours de Jeep = 2 × le prix, qu'on soit 1 ou 4. `maxParticipants` y est le nombre de **places du véhicule**, `dailyUnits` le nombre de **véhicules**. Basculer vers un prix par personne et par jour, ce serait `cartItemUnits` et `createDailyBooking`, et rien d'autre — les tests figent la lecture actuelle.
- **Toute rupture du format du panier impose de bumper `version` dans le `persist` Zustand.** Les paniers incompatibles sont **jetés** (`migrate: () => ({ items: [] })`), jamais convertis : un panier n'engage rien, aucune place n'y est retenue, et un convertisseur serait un chemin de lecture que plus rien ne teste.
- **`ActivitySlot.endTime` est DÉRIVÉE de `Activity.durationMinutes`, jamais stockée**, et uniquement dans `toActivitySlot`. Elle vaut `null` au-delà de 24 h : « 09:00 – 09:00 » se lit comme une durée nulle et « 09:00 – 15:00 » comme six heures, alors que le schéma autorise 14 jours en mode créneau. Traverser minuit, en revanche, reste lisible.

**Un opérateur désactivé est refusé par `operatorProcedure`, pas seulement par son rôle.** `setOperatorActive(false)` rétrograde le compte en `tourist`, mais `ctx.user.role` vient de la **session** (cache de 5 min) : la rétrogradation seule laissait une fenêtre pendant laquelle il continuait d'écrire. La garde lit `operator.active` en base à chaque requête. Elle couvre aussi le cas que la rétrogradation ne peut pas traiter : un `admin`/`superadmin` doté d'un profil opérateur n'est jamais rétrogradé, il serait sinon opérateur actif à vie.

**Retirer un opérateur a DEUX formes, et c'est la base qui l'impose.** `activities → slots` est en CASCADE mais `slots → bookings` en RESTRICT : dès qu'une réservation existe, la suppression casserait sur une clé étrangère et effacerait l'historique de touristes qui n'ont rien demandé. `deleteOperator` n'accepte donc que l'opérateur **vierge** (celui créé par erreur) ; au-delà, `setOperatorActive(false)` archive ses activités, rétrograde son compte en `tourist` et conserve tout. `deletable` est dérivé côté serveur par `listOperators` — l'écran l'affiche, le service le **recompte** sous transaction. La réactivation rend le rôle mais **ne désarchive pas** : republier en masse ressusciterait des départs passés et des prix périmés.

## Dettes assumées — acceptables avant lancement, pas au lancement

- **Vérification d'email désactivée** (pas de Resend) : on peut s'inscrire avec l'adresse d'autrui. Corollaire : le champ email du profil est en lecture seule — changer d'adresse exigerait de vérifier la nouvelle.
- **Rien ne freine encore la réservation.** Le garde-fou posé au lot 6 (une réservation active par créneau et par compte) empêche l'empilement trivial, mais **il est appliqué dans le service, pas par une contrainte en base** : Prisma ne modélise pas les index partiels et en supprimerait un au prochain `migrate dev`, silencieusement — exactement le risque que la règle sur `db push` existe pour éviter. La garantie tient parce que le contrôle est fait **après** l'UPDATE conditionnel, donc sous le verrou de ligne du créneau. À remplacer par un vrai index partiel le jour où Stripe rend l'acompte bloquant.
- **L'envoi de photos fonctionne en local** (vérifié le 09/09/2026 : `put()` puis `del()` réels sur le store). `BLOB_READ_WRITE_TOKEN` vit dans **`.env.local`**, pas dans `.env` — un `grep` sur le seul `.env` conclut à tort qu'il manque. ⚠️ **Sa présence sur Vercel n'a pas été vérifiée** : sans CLI ni connecteur authentifié, impossible de le confirmer d'ici. À contrôler avant de compter dessus en production.
  - Toutes les images du site passent par `ImageDropzone` (zone pointillée : glisser-déposer, clic, aperçu, retrait) — activité, guide, catégorie et logo d'opérateur. La saisie d'URL n'a pas disparu, elle est **repliée** derrière « Coller une adresse à la place » : elle reste indispensable pour les visuels internes (`/images/…`) dont le seed est rempli, et c'est le seul chemin qui survit si le jeton venait à manquer.
  - `upload()` ne transmet pas le message de la route : il jette « Failed to retrieve the client token » quelle que soit la cause. La raison lisible vient donc d'un `GET /api/upload`, que le composant consulte **après** l'échec.
- **Le mot de passe du seed est public.** `AdminTrip4Mauritius` est en clair dans `prisma/seed.ts`, sur un dépôt GitHub public, et vaut pour les 6 comptes prédéfinis — admin compris. C'est un choix de confort assumé pour la démonstration. **Poser `SEED_PASSWORD` avant d'ouvrir le site à de vrais utilisateurs**, et changer le mot de passe de l'admin de production.
- **Comptes de test `@example.com`** présents en production, laissés pour les tests client. À nettoyer avant mise en ligne.
- **Descriptions d'activités générées** par gabarit dans le seed — à remplacer par de vrais textes.
- **`images.unoptimized: true`** alors que certaines images pèsent ~1 Mo.
- ⚠️ **Maurice n'est pas dans les pays supportés par Stripe** — Connect est probablement inutilisable pour reverser les opérateurs. À vérifier avant tout engagement sur le modèle économique.

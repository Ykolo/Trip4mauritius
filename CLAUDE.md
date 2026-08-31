# MauriExplore / Trip4mauritius

PWA marketplace touristique pour l'île Maurice. Touristes réservent des activités, opérateurs locaux les publient, admins modèrent.

**Plan de référence : [docs/BACKEND-PLAN.md](docs/BACKEND-PLAN.md)** — le lire avant toute tâche backend.

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

- **`prisma db push` est interdit.** Les contraintes `CHECK` sont écrites à la main dans le SQL des migrations ; `db push` les supprimerait en silence et rendrait la survente possible. Utiliser `prisma migrate dev` / `deploy`.
- **Le `.env` local pointe sur la branche Neon `dev`, jamais sur la production.** `migrate reset` et le seed sont destructifs.
- **Tout horaire d'activité se formate via `lib/datetime.ts`** (`Indian/Mauritius`, UTC+4, sans DST). Le fuseau du navigateur afficherait un départ de 09:00 à 07:00 pour un touriste à Paris.
- **La base stocke `spotsTaken`, le front lit `spotsLeft`.** Conversion uniquement dans `server/mappers/`.
- **Les prix se recalculent côté serveur**, jamais depuis la requête client. Zod valide la forme, pas la véracité. Le calcul 20/80 (RULE-001) vit dans `lib/pricing.ts`, en centimes entiers, et sert **aussi** à l'affichage client — deux implémentations divergeraient au premier arrondi.
- **Le panier vit dans le navigateur** (`lib/stores/cart.ts`, Zustand + localStorage), pas en base. Tout ce qu'il contient est modifiable par l'utilisateur : `booking.create` ne reçoit que `slotId` + `participants`, jamais un montant.
- **Toute écriture concurrente sur un créneau passe par un UPDATE conditionnel atomique**, jamais par un read-then-write. Même schéma pour l'annulation (`updateMany` gardé sur le statut). Les lignes de panier sont **triées par `slotId`** avant traitement : sans cet ordre de verrouillage commun, deux paniers croisés s'interbloquent.
- **Tout router `operator` filtre par `ctx.operator.id`**, y compris en lecture par id.
- **`role` est en `input: false`** dans Better Auth — sinon on pourrait s'inscrire admin. Le formulaire d'inscription ne propose donc aucun choix de rôle : tout le monde s'inscrit `tourist`.
- **`server/services/admin.ts` est le SEUL fichier qui écrit `User.role`**, et il ne sait pas fabriquer d'admin : le premier et unique admin vient du seed. `operator.requestAccess` crée un profil `Operator` sans toucher au rôle — sans quoi ce serait un endpoint d'auto-promotion.
- **La description d'activité n'exige que le français.** Les traductions manquantes sont comblées à la lecture par `toDescription` (`server/mappers/activity.ts`). Exiger les 5 langues à l'écriture poussait à coller cinq fois le même texte, et la base ne distinguait plus une traduction d'un copier-coller.
- **Les images d'activité sont des URLs**, pas des fichiers : `data:` est explicitement refusé par le schéma. Un base64 dans `imageUrls` serait relu à chaque affichage du catalogue.
- **La protection des routes vit dans `proxy.ts`** (`middleware.ts` est déprécié en Next 16 ; le proxy tourne sur le runtime Node). Elle ne lit qu'un cookie : c'est du confort d'UX, **l'autorisation reste dans les procédures tRPC**.
- **Le service worker (`public/sw.js`) ne met en cache que des ressources publiques et immuables** — `/_next/static/*` et les médias. `/api/` n'est pas intercepté et aucune page HTML n'est stockée : ces réponses dépendent de la session, et les écrire sur le disque les rendrait lisibles hors ligne par l'utilisateur suivant d'un appareil partagé. Changer le cache impose de bumper `CACHE_NAME` (c'est `activate` qui purge les anciens).
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

## Intégration continue

`.github/workflows/ci.yml` — sur chaque PR et sur `main` : `tsc --noEmit`, `prisma migrate deploy`, `npm test`.

Les tests d'intégration y visent un **Postgres jetable lancé dans le runner** (`postgres:18-alpine`), pas une branche Neon. Ils ne dépendent d'aucune fonctionnalité Neon — seulement des CHECK et de la séquence créés par le SQL des migrations. D'où : aucun secret de base en CI, et deux PR simultanées ne peuvent plus s'écraser sur les mêmes tables. En local, `npm test` continue de viser la branche `dev` via `.env`.

## État d'avancement

| Lot | État |
|---|---|
| 1 · Fondations Prisma | ✅ 9 contraintes CHECK en base |
| 2 · Seed | ✅ 22 activités, 504 créneaux, 4 opérateurs, 1 admin |
| 3 · Services + tRPC | ✅ |
| 4 · Lecture publique (RSC) | ✅ vérifié en production |
| 5 · Auth | ✅ email/mot de passe branché, `proxy.ts` en place — **Google et magic link écartés** |
| 6 · Réservation | ✅ création, annulation, panier Zustand — 14 tests verts dont la concurrence |
| 7 · Espace opérateur | ✅ CRUD, créneaux, cloisonnement vérifié par tests |
| 8 · Admin | ✅ modération, validation des opérateurs, révocation |

**37 tests verts** (`npm test`) : concurrence, RULE-001, annulation, cloisonnement opérateur, fuseau, modération.

## Dettes assumées — acceptables avant lancement, pas au lancement

- **Vérification d'email désactivée** (pas de Resend) : on peut s'inscrire avec l'adresse d'autrui. Corollaire : le champ email du profil est en lecture seule — changer d'adresse exigerait de vérifier la nouvelle.
- **Rien ne freine encore la réservation.** Le garde-fou posé au lot 6 (une réservation active par créneau et par compte) empêche l'empilement trivial, mais **il est appliqué dans le service, pas par une contrainte en base** : Prisma ne modélise pas les index partiels et en supprimerait un au prochain `migrate dev`, silencieusement — exactement le risque que la règle sur `db push` existe pour éviter. La garantie tient parce que le contrôle est fait **après** l'UPDATE conditionnel, donc sous le verrou de ligne du créneau. À remplacer par un vrai index partiel le jour où Stripe rend l'acompte bloquant.
- **Pas d'envoi de fichiers.** Photos d'activité et logo opérateur se saisissent en URL. Vercel Blob n'est pas installé et aucun `BLOB_READ_WRITE_TOKEN` n'est posé — à provisionner avant d'ouvrir aux opérateurs réels, sinon chacun devra héberger ses images ailleurs.
- **Comptes de test `@example.com`** présents en production, laissés pour les tests client. À nettoyer avant mise en ligne.
- **Descriptions d'activités générées** par gabarit dans le seed — à remplacer par de vrais textes.
- **`images.unoptimized: true`** alors que certaines images pèsent ~1 Mo.
- ⚠️ **Maurice n'est pas dans les pays supportés par Stripe** — Connect est probablement inutilisable pour reverser les opérateurs. À vérifier avant tout engagement sur le modèle économique.

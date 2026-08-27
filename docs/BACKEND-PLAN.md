# MauriExplore — Plan Backend

> [!NOTE]
> **État actuel** : frontend 100 % mock. Aucune route API, aucune auth, aucune requête base.
> **Infra prête** : Neon `trip4mauritius` (eu-central-1, PG 18), Vercel `ykolos-projects/trip4mauritius`, auto-deploy sur push.

> [!IMPORTANT]
> **Périmètre : tout sauf le paiement.** Lecture, auth, réservation, espace opérateur, modération admin.
> Une réservation passe directement à `confirmed`. Stripe et les reversements sont reportés (§12).

---

## 1. Stack

| Couche | Choix |
|--------|-------|
| API | **tRPC v11** + Route Handlers pour les entrées machine |
| Rendu public | **React Server Components** (voir §2) |
| Runtime | Next.js 16, runtime **Node.js** (Fluid Compute) — jamais Edge |
| Base | Neon Postgres 18, eu-central-1 |
| ORM | **Prisma** |
| Auth | **Better Auth** — Google, Apple, magic link, email/mot de passe |
| Validation | **Zod** |
| Données client | TanStack Query, via l'intégration tRPC |
| Fichiers | Vercel Blob |
| Email | Resend |

---

## 2. Stratégie de rendu — à lire avant tout le reste

**Le problème constaté.** Aujourd'hui `/activities` ne sert que des skeletons dans son HTML : `useActivities` remplit ses données dans un `useEffect`, donc au rendu serveur `data` est `null`. Et `/activities/[slug]`, bien que composant serveur, **fabrique son titre depuis l'URL** sans aucune donnée réelle. Les deux pages centrales de la marketplace ne livrent rien d'indexable.

Brancher tRPC en fetch client sur ces pages **conserverait** ce défaut. Pour une marketplace touristique dont l'acquisition passe par la recherche organique, c'est inacceptable.

**Décision : architecture hybride.**

| Surface | Rendu | Pourquoi |
|---------|-------|----------|
| `/`, `/activities`, `/activities/[slug]` | **RSC**, lecture serveur | contenu indexable, premier rendu rapide |
| Filtres, panier, checkout | client | interactif par nature |
| `/account`, `/bookings`, `/operator/*` | client + tRPC | authentifié, jamais indexé |

**Les filtres sont déjà pilotés par l'URL** (`useSearchParams` dans `activities/page.tsx`). C'est une chance : un changement de filtre devient une navigation, le serveur re-rend la liste filtrée, et chaque combinaison de filtres est indexable. On travaille avec le grain existant, pas contre.

### Une couche service, deux consommateurs

Pour éviter de dupliquer la logique de lecture entre RSC et tRPC :

```
server/services/activity.ts   ← la logique vit ici, une seule fois
        ├── appelée directement par les RSC (pages publiques)
        └── enveloppée par les routers tRPC (client authentifié)
```

Les routers tRPC deviennent de fines enveloppes : validation Zod, autorisation, délégation au service. Bénéfice secondaire — les services se testent sans monter de contexte tRPC.

---

## 3. Réconciliation du schéma — à traiter en premier

`db/migrations/0001_initial_schema.sql` est **déjà appliquée** en base, et entre en conflit avec la suite :

1. **Better Auth apporte ses propres tables** (`user`, `session`, `account`, `verification`) — ma table `users` fait doublon.
2. **`prisma migrate` veut être seul maître du schéma.**

**Décision : on repart de Prisma.** La base est vide, le coût est nul. `prisma migrate reset`, puis `prisma/schema.prisma` devient canonique. Le fichier SQL est marqué *superseded* et ne fait plus autorité.

On adopte les conventions Better Auth et on **étend** son modèle. Se battre contre l'adapter à chaque montée de version coûte plus cher que d'accepter ses noms.

### Invariants à porter en base

- `ActivitySlot` : `spotsTaken` (compteur croissant), **jamais** `spotsLeft` — plus `CHECK (spots_taken <= max_spots)`.
- `Booking` : `CHECK (deposit_due + balance_due_on_site = total_price)`.
- `BookingStatus` : garder les **5 états** malgré le report du paiement. En ajouter un plus tard est une migration ; l'omettre force à réécrire la machine.
- `ActivityStatus` : ajouter **`archived`** (voir §7).

> [!WARNING]
> Les `CHECK` ne s'expriment pas en Prisma — il faut les écrire à la main (`prisma migrate dev --create-only`, puis édition du SQL).
> **Et `prisma db push` est interdit sur ce projet.** Il court-circuite les migrations et supprimerait ces contraintes sans le dire. Un seul usage et la survente redevient possible, silencieusement.

---

## 4. Prisma + Neon

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // pooled
  directUrl = env("DATABASE_URL_UNPOOLED")  // migrations
}
```

Les deux variables sont **déjà posées sur Vercel (Production)**. Deux ajustements :

1. **Ajouter `?pgbouncer=true&connection_limit=1`** à la chaîne poolée. Sans ça, Prisma prépare des requêtes que PgBouncer ne gère pas en mode transaction → erreurs intermittentes en production, pénibles à diagnostiquer. La valeur actuelle ne les contient pas.
2. Rien sur Preview (délibéré). Le jour où il en faut → **une branche Neon par PR**.

Client Prisma en singleton (`lib/db.ts`).

---

## 5. Fuseau horaire — source de bugs silencieux

**Maurice est à UTC+4, sans changement d'heure.**

La base stocke du `timestamptz`, mais `ActivitySlot` expose `date` et `time` comme chaînes séparées. Si le formatage se fait dans le fuseau du navigateur, un touriste à Paris voit un départ de 09:00 affiché **07:00**. Aucune erreur levée — juste une excursion ratée.

**Règle** : tout formatage d'horaire d'activité est épinglé sur `Indian/Mauritius`, jamais sur le fuseau du client. Une seule fonction (`lib/datetime.ts`), utilisée partout, y compris dans les emails. L'absence de DST à Maurice évite au moins les cas limites de bascule.

---

## 6. tRPC — structure

```
server/
  services/            # logique métier, partagée RSC ↔ tRPC
  trpc/
    init.ts            # contexte, procédures, middlewares
    root.ts
    routers/           # activity, booking, operator, admin
```

| Procédure | Garantit |
|-----------|----------|
| `publicProcedure` | rien |
| `protectedProcedure` | `ctx.user` typé non-nullable |
| `operatorProcedure` | `role = operator` **et** charge `ctx.operator` |
| `adminProcedure` | `role = admin` |

**C'est le vrai gain de tRPC** : le middleware affine le type du contexte. Dans une `operatorProcedure`, `ctx.operator.id` existe au niveau du type — le filtre ne peut pas être oublié par distraction.

> **Règle non négociable** : tout router `operator` applique `where: { operatorId: ctx.operator.id }` **systématiquement**, y compris sur les lectures par id. Un opérateur ne doit jamais lire une réservation d'un autre en devinant un UUID.

---

## 7. Rôles, cycles de vie

**Devenir opérateur.** Tout le monde s'inscrit en `tourist`. Un utilisateur demande le statut opérateur (`operator.requestAccess`), un admin valide (`admin.approveOperator`) — ce qui crée l'`Operator` et bascule `role`. *Le rôle vivant dans la session, une promotion ne prend effet qu'à la reconnexion ou au rafraîchissement de session : le prévoir dans l'UX.*

**Premier admin** : créé par le seed, jamais par l'application. Aucun endpoint ne doit pouvoir fabriquer un admin.

**Archiver, ne pas supprimer.** `activities → slots` est en CASCADE et `slots → bookings` en RESTRICT : supprimer une activité réservée casse sur une contrainte de clé étrangère illisible. Les activités passent donc en `archived` — elles disparaissent du catalogue, les réservations passées restent intactes.

---

## 8. Réservation : la concurrence

Même sans paiement, **c'est le seul endroit où la correction du système est en jeu**. Deux touristes peuvent viser la dernière place à la même milliseconde.

Prisma n'expose pas `SELECT ... FOR UPDATE`. La bonne réponse n'est pas de le contourner en `$queryRaw`, c'est un **UPDATE conditionnel atomique** :

```sql
UPDATE activity_slots
   SET spots_taken = spots_taken + $participants
 WHERE id = $slotId
   AND spots_taken + $participants <= max_spots
```

`count = 0` ⇒ plus de place ⇒ `TRPCError` `CONFLICT`. Postgres verrouille la ligne implicitement : pas de verrou explicite, pas d'interblocage, un seul aller-retour. Plus simple **et** plus solide que `FOR UPDATE`.

Dans un `prisma.$transaction` :

```
1. lire l'activité (prix serveur — jamais celui du client)
2. UPDATE conditionnel  → 0 ligne ⇒ CONFLICT
3. calculer les montants (RULE-001 : acompte 20 %)
4. créer le Booking en status = confirmed
```

**L'annulation doit rendre les places.** `booking.cancel` décrémente `spotsTaken` **dans la même transaction** que le passage à `cancelled`. Une annulation qui ne libère pas les places fait fuir l'inventaire définitivement : les créneaux se remplissent d'annulations et ne se revendent jamais. Même exigence future pour l'expiration.

Trois points qui restent vrais sans Stripe :

- **Le montant est recalculé côté serveur.** Zod valide la *forme*, pas la *véracité* : ne jamais faire confiance à un prix venu du client.
- **`bookingRef`** via une séquence Postgres (SQL brut dans la migration), pas un `count()+1` — qui produit des doublons en concurrence.
- **`CHECK (spots_taken <= max_spots)`** reste le filet si une requête oublie un jour la condition.

> [!CAUTION]
> **Sans paiement, plus rien ne freine la réservation.** L'acompte de 20 % n'est pas qu'un modèle économique, c'est le mécanisme anti-abus : n'importe quel compte peut aujourd'hui verrouiller tous les créneaux gratuitement.
> Acceptable avant lancement, **dangereux le jour de la mise en ligne**. À ne pas laisser passer en production sans soit Stripe, soit une limite par utilisateur et par créneau.

---

## 9. Better Auth

Adapter Prisma, plus :

- **Social** : Google, Apple. *(Apple exige un compte développeur payant et une clé signée — délai administratif, pas une case à cocher.)*
- **Magic link** via Resend, **email + mot de passe** avec vérification.
- **`additionalFields`** : `role`, `locale` — met le rôle dans la session, évite un aller-retour base par requête.

Magic link et mot de passe **coexistent** nativement. Conseil : ouvrir avec Google + magic link, n'activer le mot de passe que si les retours le réclament — chaque méthode ajoute une surface à sécuriser (reset, énumération de comptes).

`middleware.ts` protège les routes privées, **mais ce n'est qu'un confort UX**. La vraie autorisation est dans les procédures tRPC : un middleware ne protège pas un appel d'API direct.

---

## 10. Zod & contrats

Schémas dans `lib/schemas/`, servant à la fois d'**input tRPC**, de **resolver `react-hook-form`** (déjà en place dans `ActivityForm.tsx`, `AuthForm.tsx`) et de source de types.

`types/activity.ts` et `types/cart.ts` restent le **contrat de sortie** : les services renvoient exactement `Activity`, `ActivityFull`, `Booking`.

- **`description` multilingue** : valider les 5 clés `fr|en|de|es|ru`. Un objet partiel casse l'affichage sans erreur.
- **`spotsLeft` vs `spotsTaken`** : conversion dans **une seule** fonction de mapping. Dupliquée, elle divergera.
- **`priceFrom`** est dérivé, jamais stocké.

---

## 11. Découpage

| # | Lot | Sortie vérifiable |
|---|-----|-------------------|
| 1 | **Fondations** — `migrate reset`, schéma, CHECK manuels, singleton | `migrate status` propre, contraintes présentes |
| 2 | **Seed** — mocks → `prisma/seed.ts` (+ admin, opérateurs) | les données du front existent en base |
| 3 | **Services + tRPC** — couche service, init, 4 procédures | `activity.list` répond bout en bout |
| 4 | **Lecture publique** — RSC sur `/`, `/activities`, `/[slug]` | **le HTML servi contient les titres d'activités** |
| 5 | **Auth** — Better Auth, middleware, `AuthForm` | Google + magic link, rôle en session |
| 6 | **Réservation** — création, annulation avec libération | N réservations parallèles sur 1 place ⇒ 1 seule passe |
| 7 | **Opérateur** — CRUD, créneaux, Blob, stats, demande d'accès | un opérateur ne voit que ses données |
| 8 | **Admin** — modération, validation opérateurs | `draft → pending → published` |

> **Le lot 2 avant le 3, toujours.** Sans données en base, on ne distingue pas un router cassé d'une base vide.

### Tests qui valent l'effort

- **Concurrence sur `booking.create`** — N appels parallèles sur un créneau à 1 place. Seul bug de cette itération produisant une survente réelle, et invisible en test manuel.
- **Annulation** — après annulation, la place est bien revendable.
- **RULE-001** — Gherkin de `docs/TEST-reservation-flow.md` (100 € × 2 ⇒ 200 / 40 / 160).
- **Cloisonnement opérateur** — A ne peut pas lire une réservation de B via son id.
- **Rendu SEO** — le HTML de `/activities` contient les titres. Un test qui aurait attrapé le défaut actuel.

---

## 12. Reporté

**Paiement Stripe.** Le schéma garde `pending_payment`, `expiresAt`, `Payment`, `ProcessedStripeEvent` : rien à re-migrer.

**Reversements opérateurs.** ⚠️ **Maurice ne figure pas dans les pays supportés par Stripe** — Connect est probablement inutilisable pour payer les opérateurs mauriciens. **À vérifier avant tout engagement sur le modèle de payout** : si confirmé, il faudra un PSP local (MIPS) ou des virements hors plateforme. `/operator/wallet` reste un relevé en lecture.

**`next-intl`.** Prévu dans `ARCHITECTURE.md`, non installé. Le routing localisé change les URLs — donc le SEO et les slugs. À trancher avant de multiplier les pages.

**Avis clients.** `rating` / `reviewCount` existent en schéma mais ne sont alimentés par rien — le seed les fixe en dur. Colonnes en attente, à ne pas confondre avec une fonctionnalité.

**Hors périmètre** : messagerie touriste↔opérateur, remboursements partiels, multi-devises (tout en EUR), blog/landing SEO.

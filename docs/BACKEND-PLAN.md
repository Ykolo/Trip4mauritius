# MauriExplore — Plan Backend

> [!NOTE]
> **État actuel** : frontend 100 % mock. Aucune route API, aucune auth, aucune requête base.
> Toute la donnée vient de `MOCK_ACTIVITIES` / `MOCK_CART_ITEMS` (`lib/hooks/useActivities.ts`, `lib/hooks/useCart.ts`).
> **Infra prête** : Neon `trip4mauritius` (eu-central-1, PG 18), Vercel `ykolos-projects/trip4mauritius`, auto-deploy sur push.

> [!IMPORTANT]
> **Périmètre de cette itération : tout sauf le paiement.**
> Lecture, auth, réservation, espace opérateur, modération admin. Une réservation passe directement à `confirmed`.
> Stripe et les reversements opérateurs sont explicitement reportés (§11).

---

## 1. Stack

| Couche | Choix |
|--------|-------|
| API | **tRPC v11** (routers typés) + Route Handlers pour les entrées machine |
| Runtime | Next.js 16, runtime **Node.js** (Fluid Compute) — jamais Edge |
| Base | Neon Postgres 18, eu-central-1 |
| ORM | **Prisma** (+ `directUrl` pour les migrations) |
| Auth | **Better Auth** — Google, Apple, magic link, email/mot de passe |
| Validation | **Zod** (déjà installé) |
| Données client | TanStack Query, via l'intégration tRPC |
| Fichiers | Vercel Blob (photos activités) |
| Email | Resend (magic link + confirmations) |

### Pourquoi tRPC s'impose bien ici

Le front est **entièrement en composants clients** (`'use client'` partout, données via hooks). tRPC + TanStack Query se substitue aux mocks presque 1:1 : la signature des hooks change peu, les composants ne bougent pas. C'est le scénario où tRPC coûte le moins et rapporte le plus.

### Deux surfaces, pas une

```
app/api/trpc/[trpc]/route.ts   → tRPC        : tout ce que l'app appelle
app/api/auth/[...all]/route.ts → Better Auth : sessions, OAuth, magic link
app/api/webhooks/stripe/route.ts → plain     : (reporté) signature = corps brut, incompatible tRPC
app/api/cron/*/route.ts          → plain     : appelé par Vercel Cron, pas par un client typé
```

**Tout ce qui n'est pas appelé par ton propre front reste un Route Handler.** tRPC n'apporte rien à une machine qui n'a pas ton client typé, et sa couche de parsing gêne la vérification de signature.

---

## 2. Réconciliation du schéma — à traiter en premier

La migration SQL `db/migrations/0001_initial_schema.sql` est **déjà appliquée** en base. Elle entre en conflit avec la suite sur deux points :

1. **Better Auth apporte ses propres tables** : `user`, `session`, `account`, `verification`. Ma table `users` fait doublon.
2. **`prisma migrate` veut être seul maître du schéma.** Une migration écrite à la main hors de son historique le met en dérive dès la première commande.

**Décision : on repart de Prisma, et `0001_initial_schema.sql` devient caduque.** La base est vide — le coût est nul, c'est le bon moment. Concrètement :

- `prisma migrate reset` sur la base Neon (rien à perdre, zéro ligne).
- Le schéma canonique devient `prisma/schema.prisma`.
- On garde le fichier SQL en référence documentaire, marqué *superseded*, ou on le supprime. Ne pas le laisser traîner comme s'il faisait autorité.

On adopte les conventions Better Auth (`user` au singulier, ses noms de colonnes) et on **étend** son modèle plutôt que de l'adapter au nôtre. Se battre contre l'adapter à chaque montée de version coûte plus cher que d'accepter ses noms.

### Modèle cible

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  // champs métier ajoutés via additionalFields côté Better Auth
  role          UserRole  @default(tourist)
  locale        String    @default("fr")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions  Session[]
  accounts  Account[]
  operator  Operator?
  bookings  Booking[]
}
// + Session, Account, Verification : générés par `better-auth generate`, ne pas écrire à la main
```

Le reste du domaine reprend le modèle validé précédemment — `Operator`, `Activity`, `ActivitySlot`, `Booking`, `Payment`, `ProcessedStripeEvent` — avec ses invariants :

- `ActivitySlot` : `spotsTaken` (compteur croissant), **jamais** `spotsLeft`, plus `CHECK (spots_taken <= max_spots)`.
- `Booking` : `CHECK (deposit_due + balance_due_on_site = total_price)`.
- `BookingStatus` : on **garde les 5 états** (`pending_payment`, `confirmed`, `expired`, `cancelled`, `completed`) même si le paiement est reporté. Ajouter un état plus tard est une migration ; l'omettre maintenant force à réécrire la machine.

> Les `CHECK` ne s'expriment pas en Prisma. Il faut les ajouter à la main dans la migration générée (`prisma migrate dev --create-only`, puis édition du SQL). **C'est l'étape qu'on oublie** — et sans elle, la survente redevient possible.

---

## 3. Prisma + Neon : le câblage exact

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // pooled
  directUrl = env("DATABASE_URL_UNPOOLED")  // migrations
}
```

`DATABASE_URL` et `DATABASE_URL_UNPOOLED` sont **déjà posées sur Vercel (Production)**. Deux ajustements nécessaires :

1. **La chaîne poolée doit recevoir `?pgbouncer=true&connection_limit=1`.** Sans ça, Prisma prépare des requêtes que PgBouncer ne sait pas gérer en mode transaction → erreurs intermittentes en production, difficiles à diagnostiquer. La valeur actuelle ne les contient pas : à corriger.
2. **Les variables ne sont pas sur Preview** (choix délibéré : ne pas laisser une preview écrire en prod). Quand il faudra des previews fonctionnelles → une **branche Neon par PR**.

Client Prisma en singleton (`lib/db.ts`) pour survivre au rechargement à chaud en dev et à la réutilisation d'instances Fluid Compute.

---

## 4. tRPC — structure

```
server/
  trpc/
    init.ts              # contexte, procédures de base, middlewares
    root.ts              # appRouter
    routers/
      activity.ts
      booking.ts
      operator.ts
      admin.ts
lib/
  trpc/client.tsx        # provider TanStack Query + client tRPC
```

### Contexte et procédures

Le contexte porte `{ db, session }`, la session venant de Better Auth (`auth.api.getSession`).

Quatre procédures, chacune un cran plus restrictif :

| Procédure | Garantit |
|-----------|----------|
| `publicProcedure` | rien |
| `protectedProcedure` | `session` non nulle → `ctx.user` typé non-nullable |
| `operatorProcedure` | `role = operator` **et** charge `ctx.operator` |
| `adminProcedure` | `role = admin` |

**C'est le vrai gain de tRPC sur des Route Handlers** : le middleware affine le type du contexte. Dans une `operatorProcedure`, `ctx.operator.id` existe au niveau du type — impossible d'oublier le filtre par inadvertance.

### Routers

**`activity`** — `list` (filtres `ActivityFilters`, pagination), `bySlug`, `slots`.
**`booking`** — `create`, `myBookings`, `cancel`.
**`operator`** — `myActivities`, `createActivity`, `updateActivity`, `submitForReview`, `mySlots`, `createSlots`, `myBookings`, `stats`.
**`admin`** — `pendingActivities`, `moderate`.

> **Règle de sécurité non négociable** : dans tout router `operator`, le filtre `where: { operatorId: ctx.operator.id }` est appliqué **systématiquement**, y compris sur les lectures par id. Un opérateur ne doit jamais pouvoir lire une réservation qui ne lui appartient pas en devinant un UUID.

---

## 5. Réservation : la concurrence, sans paiement

Même sans Stripe, c'est **le seul endroit où la correction du système est en jeu**. Deux touristes peuvent viser la dernière place à la même milliseconde.

Prisma n'expose pas `SELECT ... FOR UPDATE`. La bonne réponse n'est pas de contourner via `$queryRaw` — c'est un **UPDATE conditionnel atomique** :

```sql
UPDATE activity_slots
   SET spots_taken = spots_taken + $participants
 WHERE id = $slotId
   AND spots_taken + $participants <= max_spots
```

Si `count = 0`, il n'y a plus la place → on renvoie une `TRPCError` `CONFLICT`. Postgres verrouille la ligne implicitement le temps de l'`UPDATE` : pas de verrou explicite, pas d'interblocage possible, un seul aller-retour. Plus simple **et** plus solide que `FOR UPDATE`.

Le tout dans un `prisma.$transaction` :

```
1. lire l'activité (prix serveur — jamais celui envoyé par le client)
2. UPDATE conditionnel sur le créneau  → 0 ligne ⇒ CONFLICT
3. calculer les montants (RULE-001 : acompte 20 %)
4. créer le Booking en status = confirmed   ← sans paiement, pas d'état intermédiaire
```

Trois points qui restent vrais même sans Stripe :

- **Le montant est recalculé côté serveur**, depuis `activity.priceHt`. Ne jamais faire confiance à un prix venu du client, même avec Zod : Zod valide la *forme*, pas la *véracité*.
- **`bookingRef`** (`MX-2026-000123`) : une séquence Postgres, pas un `count()+1` — qui produit des doublons en concurrence.
- **`CHECK (spots_taken <= max_spots)`** reste le filet. Si un jour une requête oublie la condition, la base refuse quand même.

Quand Stripe arrivera, le seul changement est l'état initial (`pending_payment` + `expiresAt`) et le webhook qui confirme. La transaction d'inventaire, elle, ne bouge pas — c'est pourquoi elle vaut d'être faite correctement maintenant.

---

## 6. Better Auth

`lib/auth.ts` : adapter Prisma, plus

- **Social** : Google, Apple. *(Apple exige un compte développeur payant et une clé signée — prévoir le délai administratif, ce n'est pas une case à cocher.)*
- **Magic link** : via Resend.
- **Email + mot de passe** : activé, avec vérification d'email.
- **`additionalFields`** : `role`, `locale` — c'est ce qui met le rôle *dans la session*, et évite un aller-retour base à chaque requête tRPC.

Tu hésitais entre magic link et mot de passe : **les deux peuvent coexister**, Better Auth le gère nativement. Mon conseil — ouvrir avec Google + magic link, et n'activer le mot de passe que si les retours le réclament. Chaque méthode ajoutée est une surface à sécuriser (reset, énumération de comptes, robustesse).

`middleware.ts` protège `/account`, `/bookings`, `/checkout`, `/operator/*` — **mais le middleware n'est qu'un confort UX**. La vraie autorisation est dans les procédures tRPC. Un middleware ne protège pas un appel d'API direct.

---

## 7. Zod : un schéma, trois usages

Les schémas vivent dans `lib/schemas/` et servent à la fois d'**input tRPC**, de **resolver `react-hook-form`** (`ActivityForm.tsx`, `AuthForm.tsx` sont déjà branchés dessus) et de source de types.

Les types de `types/activity.ts` et `types/cart.ts` restent le **contrat de sortie** : les routers renvoient exactement `Activity`, `ActivityFull`, `Booking`. Ça garantit que les composants ne bougent pas.

Deux points de vigilance :

- **`description` multilingue** : valider les 5 clés `fr|en|de|es|ru` à l'écriture. Un objet partiel casse l'affichage sans erreur explicite.
- **`spotsLeft` vs `spotsTaken`** : la base stocke `spotsTaken`, le front lit `spotsLeft`. La conversion se fait dans **une seule** fonction de mapping (`server/mappers/activity.ts`). Dupliquée, elle divergera.
- **`priceFrom` est dérivé**, jamais stocké.

---

## 8. Migration du front

Ordre imposé par les dépendances :

1. `useActivities` → `trpc.activity.list.useQuery()`. **La signature du hook ne change pas** : les composants ne sont pas touchés. C'est ce qui rend la bascule indolore et réversible.
2. `useCart` : le panier **reste en localStorage**. Il ne devient serveur qu'au moment de `booking.create`. Persister un panier anonyme n'apporte rien au MVP.
3. Les pages opérateur passent sur `trpc.operator.*`.

---

## 9. Variables d'environnement

```
DATABASE_URL=              # ✅ posée — à compléter avec ?pgbouncer=true&connection_limit=1
DATABASE_URL_UNPOOLED=     # ✅ posée
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID= / APPLE_CLIENT_SECRET=
RESEND_API_KEY=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_SITE_URL=      # corrige aussi le warning metadataBase du build
```

---

## 10. Découpage

| # | Lot | Contenu | Sortie vérifiable |
|---|-----|---------|-------------------|
| 1 | **Fondations** | `migrate reset`, `schema.prisma`, CHECK à la main, singleton client | `prisma migrate status` propre, contraintes présentes |
| 2 | **Seed** | `MOCK_ACTIVITIES` → `prisma/seed.ts` (+ users/operators associés) | les données du front existent en base |
| 3 | **tRPC** | init, contexte, 4 procédures, `appRouter`, provider client | un `activity.list` répond bout en bout |
| 4 | **Lecture** | router `activity`, mappers, bascule `useActivities` | `/activities` et `/activities/[slug]` servis par la base |
| 5 | **Auth** | Better Auth, middleware, `AuthForm` | connexion Google + magic link, rôle en session |
| 6 | **Réservation** | `booking.create` (transaction §5), `myBookings`, `cancel` | test de concurrence : N réservations simultanées sur 1 place ⇒ 1 seule passe |
| 7 | **Opérateur** | CRUD activités, créneaux, upload Blob, stats | un opérateur ne voit que ses données |
| 8 | **Admin** | modération | `draft → pending → published` |

> **Le lot 2 avant le 3, toujours.** Sans données en base, on ne distingue pas un router cassé d'une base vide.

### Tests qui valent l'effort

Peu, mais ceux-là :

- **Concurrence sur `booking.create`** — N appels parallèles sur un créneau à 1 place. C'est le seul bug de cette itération qui produit une survente réelle, et il est invisible en test manuel.
- **RULE-001** — les scénarios Gherkin de `docs/TEST-reservation-flow.md` (100 € × 2 ⇒ total 200, acompte 40, solde 160).
- **Cloisonnement opérateur** — l'opérateur A ne peut pas lire une réservation de l'opérateur B via son id.

---

## 11. Reporté — et pourquoi c'est acceptable

**Paiement Stripe.** Le schéma garde `pending_payment`, `expiresAt`, `Payment`, `ProcessedStripeEvent`. Rien à re-migrer le moment venu.

**Reversements opérateurs.** ⚠️ **Maurice ne figure pas dans les pays supportés par Stripe.** Stripe Connect est donc probablement inutilisable pour payer les opérateurs mauriciens. **À vérifier avant tout engagement sur le modèle de payout** — si c'est confirmé, il faudra soit un PSP local (MIPS), soit des virements hors plateforme. `/operator/wallet` reste un relevé en lecture d'ici là.

**`next-intl`.** Prévu dans `ARCHITECTURE.md` mais non installé. Le routing localisé change les URLs — donc le SEO et les slugs. À trancher avant de multiplier les pages.

**Hors périmètre produit** : avis, messagerie touriste↔opérateur, remboursements partiels, multi-devises (tout est en EUR), blog/landing SEO.

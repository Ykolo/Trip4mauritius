# AGENTS.md — MauriExplore / Trip4mauritius

PWA marketplace touristique pour l'île Maurice. Touristes réservent des activités, opérateurs locaux les publient, admins modèrent.

## À lire avant d'écrire du code

Ce fichier est volontairement court. Les règles du projet vivent dans deux documents, et **ils font autorité** :

1. **[CLAUDE.md](CLAUDE.md)** — architecture, conventions, et les règles à ne pas enfreindre (fuseau `Indian/Mauritius`, `spotsTaken` vs `spotsLeft`, prix recalculés côté serveur, cloisonnement opérateur…). À lire systématiquement.
2. **[docs/BACKEND-PLAN.md](docs/BACKEND-PLAN.md)** — le plan de référence. À lire avant toute tâche backend.

Ne pas dupliquer ces règles ici : deux copies divergent.

## Stack

Next.js 16 (App Router, runtime **Node.js** — jamais Edge) · tRPC v11 · Prisma 7.10.0 · Neon Postgres 18 (eu-central-1) · Better Auth · Zod · Tailwind v4 · Vercel.

## Commandes

```bash
npm run dev            # développement
npm run build          # prisma migrate deploy && next build
npm run db:migrate     # prisma migrate dev
npm run db:seed        # seed (branche Neon dev uniquement)
npx tsc --noEmit       # le projet doit typechecker proprement
```

## Trois pièges qui coûtent cher

- **`prisma db push` est interdit** — il supprimerait en silence les contraintes `CHECK` écrites à la main dans les migrations, et rendrait la survente possible. Utiliser `prisma migrate dev` / `deploy`.
- **Le `.env` local pointe sur la branche Neon `dev`, jamais sur la production.** `migrate reset` et le seed sont destructifs.
- **Après un changement de schéma, lancer `prisma generate`** — `next build` ne le fait pas.

Le détail et le reste des règles : voir [CLAUDE.md](CLAUDE.md).

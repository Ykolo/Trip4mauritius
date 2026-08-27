import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 : les URLs de connexion ne vivent plus dans schema.prisma.
// Ici, `datasource.url` sert UNIQUEMENT aux commandes CLI (migrate, introspect)
// et pointe donc sur l'endpoint DIRECT : une migration ne doit pas passer par
// le pooler en mode transaction.
// Le runtime, lui, utilise l'endpoint poolé via le driver adapter (lib/db.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
})

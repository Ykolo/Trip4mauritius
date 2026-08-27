import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Prisma 7 exige un driver adapter : le client ne lit plus d'URL depuis le
// schéma. On vise l'endpoint POOLÉ de Neon (PgBouncer) — c'est le runtime, pas
// les migrations.
//
// Singleton : survit au rechargement à chaud en dev et à la réutilisation des
// instances de fonction par Fluid Compute. Sans ça, chaque rechargement ouvre
// un nouveau pool et épuise les connexions Neon.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL est absente')
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

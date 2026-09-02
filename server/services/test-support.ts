import { db } from '@/lib/db'

// Utilitaires PARTAGÉS PAR LES TESTS. Ce fichier n'est pas un test (vitest ne
// ramasse que `*.test.ts`) et n'est importé par aucun code de production.

let cachedCategoryId: string | null = null

/**
 * Id d'une catégorie réelle, pour les activités de test.
 *
 * `Activity.categoryId` est une clé étrangère : un id inventé ferait échouer
 * l'insertion. On prend une catégorie existante plutôt que d'en créer une —
 * les catégories viennent de la migration `add_categories`, présente aussi
 * bien sur la branche Neon `dev` que sur le Postgres jetable de la CI, et en
 * créer une par test laisserait derrière lui un catalogue de déchets qu'aucun
 * `cleanup` ne ramasse (la clé étrangère est en RESTRICT).
 */
export async function testCategoryId(): Promise<string> {
  if (cachedCategoryId) return cachedCategoryId

  const category = await db.category.findFirst({ orderBy: { position: 'asc' } })

  if (!category) {
    throw new Error(
      "Aucune catégorie en base : lancer `npm run db:deploy` avant les tests.",
    )
  }

  cachedCategoryId = category.id
  return cachedCategoryId
}

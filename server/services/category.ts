import { TRPCError } from '@trpc/server'
import type { Category as DbCategory } from '@prisma/client'
import { db } from '@/lib/db'
import type { Category, CategoryAdmin } from '@/types/category'

// Catalogue des catégories.
//
// Avant, la liste des catégories vivait en dur dans trois composants qui ne
// disaient pas la même chose, et `Activity.category` était un texte libre :
// l'accueil filtrait sur des slugs (`diving`, `mer`) qu'aucune activité ne
// portait, donc ses vignettes ne renvoyaient rien. Ce service est désormais la
// seule source.

export function toCategory(category: DbCategory): Category {
  return {
    id: category.id,
    slug: category.slug,
    label: category.label,
    emoji: category.emoji,
    imageUrl: category.imageUrl,
    position: category.position,
  }
}

/**
 * Ce que voient les touristes et les opérateurs : les catégories actives.
 *
 * Une catégorie désactivée disparaît des filtres et du formulaire, mais les
 * activités déjà classées dedans restent en ligne — les retirer du catalogue
 * parce qu'un admin range sa liste serait une sanction sans rapport.
 */
export async function listActiveCategories(): Promise<Category[]> {
  const rows = await db.category.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
  })
  return rows.map(toCategory)
}

export async function listCategoriesForAdmin(): Promise<CategoryAdmin[]> {
  const rows = await db.category.findMany({
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    include: { _count: { select: { activities: true } } },
  })

  return rows.map((row) => ({
    ...toCategory(row),
    active: row.active,
    activityCount: row._count.activities,
  }))
}

/**
 * `Aventure & Nature` → `aventure-nature`.
 *
 * Les accents sont dépliés plutôt que supprimés : « Bien-être » doit donner
 * `bien-etre`, pas `bien-tre`.
 */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createCategory(input: {
  label: string
  emoji?: string
  imageUrl?: string
}): Promise<Category> {
  const slug = slugify(input.label)

  if (!slug) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ce libellé ne produit aucune adresse utilisable.',
    })
  }

  // Le conflit est détecté ici pour pouvoir l'expliquer. Laissé à la contrainte
  // d'unicité, il remonterait en erreur Prisma brute côté écran.
  const existing = await db.category.findFirst({
    where: { OR: [{ slug }, { label: input.label }] },
  })

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: existing.active
        ? `La catégorie « ${existing.label} » existe déjà.`
        : `La catégorie « ${existing.label} » existe déjà, mais elle est désactivée. Réactivez-la plutôt que d'en créer une seconde.`,
    })
  }

  // Ajoutée en fin de liste : s'insérer en tête réordonnerait le catalogue de
  // quelqu'un d'autre sans le lui demander.
  const last = await db.category.aggregate({ _max: { position: true } })

  const created = await db.category.create({
    data: {
      slug,
      label: input.label,
      emoji: input.emoji || null,
      imageUrl: input.imageUrl || null,
      position: (last._max.position ?? 0) + 1,
    },
  })

  return toCategory(created)
}

/**
 * Le SLUG N'EST PAS MODIFIABLE, volontairement.
 *
 * Il vit dans l'URL des recherches filtrées, que les touristes partagent et
 * mettent en favori, et que les moteurs ont indexées. Le renommer casserait
 * tout cela en silence — le filtre ne correspondrait plus à rien et la page
 * s'afficherait vide, sans erreur. Le libellé, lui, se change librement : il
 * n'est qu'affiché.
 */
export async function updateCategory(
  id: string,
  input: { label: string; emoji?: string; imageUrl?: string },
): Promise<Category> {
  const conflict = await db.category.findFirst({
    where: { label: input.label, id: { not: id } },
  })

  if (conflict) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Une autre catégorie porte déjà le libellé « ${input.label} ».`,
    })
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      label: input.label,
      emoji: input.emoji || null,
      imageUrl: input.imageUrl || null,
    },
  })

  return toCategory(updated)
}

/**
 * Désactiver plutôt que supprimer.
 *
 * La clé étrangère est en RESTRICT : une catégorie utilisée ne PEUT pas être
 * supprimée, et c'est voulu — sinon des activités en ligne se retrouveraient
 * sans classement. La désactivation la retire des filtres et du formulaire
 * sans toucher à l'existant.
 */
export async function setCategoryActive(
  id: string,
  active: boolean,
): Promise<void> {
  await db.category.update({ where: { id }, data: { active } })
}

/**
 * Réordonne d'un cran. Les deux écritures sont dans UNE transaction : à
 * mi-chemin, deux catégories porteraient la même position et l'affichage
 * dépendrait du hasard du tri.
 */
export async function moveCategory(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const current = await db.category.findUnique({ where: { id } })
  if (!current) throw new TRPCError({ code: 'NOT_FOUND' })

  const neighbour = await db.category.findFirst({
    where:
      direction === 'up'
        ? { position: { lt: current.position } }
        : { position: { gt: current.position } },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
  })

  // Déjà à l'extrémité : ne rien faire est la bonne réponse.
  if (!neighbour) return

  await db.$transaction([
    db.category.update({
      where: { id: current.id },
      data: { position: neighbour.position },
    }),
    db.category.update({
      where: { id: neighbour.id },
      data: { position: current.position },
    }),
  ])
}

import { TRPCError } from '@trpc/server'
import type { Guide, GuideCategory as DbGuideCategory } from '@prisma/client'
import { db } from '@/lib/db'
import { slugify } from '@/server/services/category'
import type {
  GuideAdminDetail,
  GuideAdminRow,
  GuideCategory,
  GuideCategoryAdmin,
  GuideDetail,
  GuideStatus,
  GuideSummary,
} from '@/types/guide'

// Guides éditoriaux.
//
// Même grammaire que les catégories d'activités, et pour les mêmes raisons :
// la classification est une TABLE administrable, le slug est immuable parce
// qu'il vit dans des URL partagées, et une catégorie se désactive au lieu de se
// supprimer — la clé étrangère est en RESTRICT, les articles déjà classés
// doivent survivre.
//
// Le front AFFICHE `category` (le libellé) et FILTRE sur `categorySlug`.
// Confondre les deux est exactement ce qui avait cassé le catalogue.

type GuideWithCategory = Guide & { category: DbGuideCategory }

function toSummary(guide: GuideWithCategory): GuideSummary {
  return {
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    excerpt: guide.excerpt,
    imageUrl: guide.imageUrls[0] ?? null,
    category: guide.category.label,
    categorySlug: guide.category.slug,
    updatedAt: guide.updatedAt.toISOString(),
  }
}

function toDetail(guide: GuideWithCategory): GuideDetail {
  return { ...toSummary(guide), content: guide.content, imageUrls: guide.imageUrls }
}

// ---------------------------------------------------------------------------
// Lecture publique
// ---------------------------------------------------------------------------

export async function listActiveGuideCategories(): Promise<GuideCategory[]> {
  const rows = await db.guideCategory.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
  })

  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    position: c.position,
  }))
}

/** Les guides en ligne, éventuellement filtrés sur le SLUG d'une catégorie. */
export async function listPublishedGuides(
  categorySlug?: string,
): Promise<GuideSummary[]> {
  const rows = await db.guide.findMany({
    where: {
      status: 'published',
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: { category: true },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map(toSummary)
}

export async function getPublishedGuide(
  slug: string,
): Promise<GuideDetail | null> {
  const guide = await db.guide.findFirst({
    // `status` dans le WHERE, jamais dans un `if` après coup : un brouillon ne
    // doit pas être chargé du tout, même pour être écarté ensuite.
    where: { slug, status: 'published' },
    include: { category: true },
  })

  return guide ? toDetail(guide) : null
}

/** Slugs des guides en ligne — pour la génération statique et le sitemap. */
export async function listPublishedGuideSlugs(): Promise<string[]> {
  const rows = await db.guide.findMany({
    where: { status: 'published' },
    select: { slug: true },
  })
  return rows.map((r) => r.slug)
}

// ---------------------------------------------------------------------------
// Administration — catégories
// ---------------------------------------------------------------------------

export async function listGuideCategoriesForAdmin(): Promise<
  GuideCategoryAdmin[]
> {
  const rows = await db.guideCategory.findMany({
    include: { _count: { select: { guides: true } } },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
  })

  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    position: c.position,
    active: c.active,
    guideCount: c._count.guides,
  }))
}

export async function createGuideCategory(label: string): Promise<GuideCategory> {
  const slug = slugify(label)

  if (!slug) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ce libellé ne produit aucune adresse utilisable.',
    })
  }

  // Le conflit est détecté ici pour pouvoir l'expliquer. Laissé à la contrainte
  // d'unicité, il remonterait en erreur Prisma brute côté écran.
  const existing = await db.guideCategory.findFirst({
    where: { OR: [{ slug }, { label }] },
  })

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: existing.active
        ? `La catégorie « ${existing.label} » existe déjà.`
        : `La catégorie « ${existing.label} » existe déjà, mais elle est désactivée. Réactivez-la plutôt que d'en créer une seconde.`,
    })
  }

  // En fin de liste : s'insérer en tête réordonnerait le site de quelqu'un
  // d'autre sans le lui demander.
  const last = await db.guideCategory.aggregate({ _max: { position: true } })

  const created = await db.guideCategory.create({
    data: { slug, label, position: (last._max.position ?? 0) + 1 },
  })

  return {
    id: created.id,
    slug: created.slug,
    label: created.label,
    position: created.position,
  }
}

/**
 * Le libellé se renomme, le SLUG NON.
 *
 * Il vit dans l'URL des listes filtrées, que les visiteurs partagent et que les
 * moteurs indexent. Le renommer casserait ces liens en silence : la page
 * s'afficherait vide, sans erreur.
 */
export async function renameGuideCategory(
  categoryId: string,
  label: string,
): Promise<void> {
  const clash = await db.guideCategory.findFirst({
    where: { label, id: { not: categoryId } },
  })

  if (clash) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Une catégorie « ${label} » existe déjà.`,
    })
  }

  await db.guideCategory.update({ where: { id: categoryId }, data: { label } })
}

export async function setGuideCategoryActive(
  categoryId: string,
  active: boolean,
): Promise<void> {
  await db.guideCategory.update({ where: { id: categoryId }, data: { active } })
}

// ---------------------------------------------------------------------------
// Administration — articles
// ---------------------------------------------------------------------------

export async function listGuidesForAdmin(): Promise<GuideAdminRow[]> {
  const rows = await db.guide.findMany({
    include: { category: true },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map((g) => ({ ...toSummary(g), status: g.status as GuideStatus }))
}

export async function getGuideForAdmin(
  guideId: string,
): Promise<GuideAdminDetail> {
  const guide = await db.guide.findUnique({
    where: { id: guideId },
    include: { category: true },
  })

  if (!guide) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Guide introuvable.' })
  }

  return {
    ...toDetail(guide),
    status: guide.status as GuideStatus,
    categoryId: guide.categoryId,
  }
}

/** Rend un slug libre : `securite`, puis `securite-2`, `securite-3`… */
async function uniqueGuideSlug(title: string): Promise<string> {
  const base = slugify(title)

  if (!base) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ce titre ne produit aucune adresse utilisable.',
    })
  }

  const taken = await db.guide.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  })
  const used = new Set(taken.map((g) => g.slug))

  if (!used.has(base)) return base

  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export interface GuideInput {
  title: string
  excerpt: string
  content: string
  categoryId: string
  imageUrls: string[]
  status: GuideStatus
}

export async function createGuide(input: GuideInput): Promise<GuideAdminDetail> {
  // Vérifié ici pour pouvoir l'expliquer : la clé étrangère remonterait une
  // erreur Prisma illisible côté écran.
  const category = await db.guideCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  })

  if (!category) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Catégorie introuvable.' })
  }

  const created = await db.guide.create({
    data: {
      slug: await uniqueGuideSlug(input.title),
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      categoryId: input.categoryId,
      imageUrls: input.imageUrls,
      status: input.status,
    },
  })

  return getGuideForAdmin(created.id)
}

/**
 * Le slug ne bouge pas non plus à la mise à jour.
 *
 * Corriger un titre est le geste le plus courant sur un article publié ; s'il
 * déplaçait l'adresse, chaque correction casserait les liens déjà partagés.
 */
export async function updateGuide(
  guideId: string,
  input: GuideInput,
): Promise<GuideAdminDetail> {
  const category = await db.guideCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  })

  if (!category) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Catégorie introuvable.' })
  }

  await db.guide.update({
    where: { id: guideId },
    data: {
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      categoryId: input.categoryId,
      imageUrls: input.imageUrls,
      status: input.status,
    },
  })

  return getGuideForAdmin(guideId)
}

export async function deleteGuide(guideId: string): Promise<void> {
  // Un article n'a ni réservation ni dépendance : contrairement à une activité,
  // le supprimer n'orpheline rien. La suppression est donc réelle.
  await db.guide.delete({ where: { id: guideId } })
}

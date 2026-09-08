import type { Prisma } from '@prisma/client'
import { ActivityStatus } from '@prisma/client'
import { db } from '@/lib/db'
import type { ActivityFiltersInput } from '@/lib/schemas/activity'
import { toActivity, toActivityFull } from '@/server/mappers/activity'
import type {
  ActivitiesResponse,
  ActivityFull,
  ActivitySuggestion,
} from '@/types/activity'

// Couche service : la logique de lecture vit ici, une seule fois.
// Consommée directement par les composants serveur (pages publiques) ET
// enveloppée par les routers tRPC (client authentifié). Les routers restent
// minces — valider, autoriser, déléguer.

export const ITEMS_PER_PAGE = 8

/** Nombre de suggestions sous la barre de recherche. Au-delà, on masque la page. */
export const SUGGESTION_LIMIT = 6

/**
 * Le prédicat de recherche par mot-clé — **une seule définition**.
 *
 * Partagé par la liste du catalogue et par les suggestions de la barre de
 * recherche. Deux prédicats séparés divergeraient au premier ajustement, et la
 * barre proposerait alors des activités que la page de résultats n'affiche pas
 * — ou l'inverse, ce qui est pire : suggérer puis ne rien trouver.
 *
 * `insensitive` est indispensable : personne ne retape « Catamaran Cruise to
 * Ile aux Cerfs » avec les majuscules d'origine.
 *
 * Le mot-clé porte sur le TITRE, le LIBELLÉ DE CATÉGORIE et la RÉGION, pas sur
 * la description : celle-ci est un Json multilingue, que Postgres ne sait pas
 * parcourir avec un simple `contains`. Chercher « plongée » doit sortir les
 * activités dont c'est le sujet, pas celles qui mentionnent le mot au détour
 * d'un paragraphe.
 */
function keywordMatch(q: string): Prisma.ActivityWhereInput[] {
  return [
    { title: { contains: q, mode: 'insensitive' } },
    { region: { contains: q, mode: 'insensitive' } },
    { category: { label: { contains: q, mode: 'insensitive' } } },
  ]
}

function publicWhere(filters: ActivityFiltersInput): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {
    // Seules les activités publiées sont visibles publiquement. Ce filtre n'est
    // pas optionnel : il empêche les brouillons et les activités rejetées de
    // fuiter dans le catalogue.
    status: ActivityStatus.published,
  }

  if (filters.q) where.OR = keywordMatch(filters.q)

  if (filters.region) where.region = { in: filters.region }
  // Le filtre porte sur le SLUG, jamais sur le libellé : celui-ci est
  // renommable depuis /admin/categories, et un renommage ne doit pas vider les
  // liens déjà partagés.
  if (filters.category) where.category = { slug: { in: filters.category } }
  if (filters.duration) where.duration = filters.duration
  if (filters.lang) where.languages = { hasSome: filters.lang }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceHt = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    }
  }

  return where
}

export async function listActivities(
  filters: ActivityFiltersInput,
): Promise<ActivitiesResponse> {
  const where = publicWhere(filters)
  const page = filters.page

  const [rows, total] = await Promise.all([
    db.activity.findMany({
      where,
      include: { category: true },
      orderBy: [{ rating: 'desc' }, { title: 'asc' }],
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    db.activity.count({ where }),
  ])

  return {
    activities: rows.map(toActivity),
    total,
    pages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
  }
}

/**
 * Les suggestions affichées sous la barre de recherche.
 *
 * Deux usages dans une seule requête :
 *
 *  - **sans mot-clé** (le champ vient d'être ouvert) : les mieux notées, en
 *    guise de point de départ. Une liste vide à l'ouverture n'apprend rien au
 *    visiteur sur ce qu'il peut chercher.
 *  - **avec mot-clé** : les correspondances, via le MÊME prédicat que la page
 *    de résultats.
 *
 * Charge utile volontairement maigre — de quoi dessiner une ligne et naviguer,
 * rien de plus. Cette requête part à chaque frappe (débattue côté client) : y
 * faire transiter les descriptions, les images et les créneaux coûterait à
 * chaque lettre tapée.
 */
export async function suggestActivities(q?: string): Promise<ActivitySuggestion[]> {
  const rows = await db.activity.findMany({
    where: {
      status: ActivityStatus.published,
      ...(q ? { OR: keywordMatch(q) } : {}),
    },
    select: {
      slug: true,
      title: true,
      region: true,
      category: { select: { label: true } },
    },
    orderBy: [{ rating: 'desc' }, { title: 'asc' }],
    take: SUGGESTION_LIMIT,
  })

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    region: r.region,
    category: r.category.label,
  }))
}

export async function getActivityBySlug(
  slug: string,
): Promise<ActivityFull | null> {
  const activity = await db.activity.findFirst({
    where: { slug, status: ActivityStatus.published },
    include: {
      operator: true,
      category: true,
      slots: {
        // Uniquement les créneaux à venir : proposer une date passée est au
        // mieux déroutant, au pire une réservation impossible à honorer.
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 60,
      },
    },
  })

  return activity ? toActivityFull(activity) : null
}

/** Slugs publiés — pour la génération statique et le sitemap. */
export async function listPublishedSlugs(): Promise<string[]> {
  const rows = await db.activity.findMany({
    where: { status: ActivityStatus.published },
    select: { slug: true },
  })
  return rows.map((r) => r.slug)
}

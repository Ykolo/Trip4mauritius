import type { Prisma } from '@prisma/client'
import { ActivityStatus } from '@prisma/client'
import { db } from '@/lib/db'
import type { ActivityFiltersInput } from '@/lib/schemas/activity'
import { toActivity, toActivityFull } from '@/server/mappers/activity'
import type { ActivitiesResponse, ActivityFull } from '@/types/activity'

// Couche service : la logique de lecture vit ici, une seule fois.
// Consommée directement par les composants serveur (pages publiques) ET
// enveloppée par les routers tRPC (client authentifié). Les routers restent
// minces — valider, autoriser, déléguer.

export const ITEMS_PER_PAGE = 8

function publicWhere(filters: ActivityFiltersInput): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {
    // Seules les activités publiées sont visibles publiquement. Ce filtre n'est
    // pas optionnel : il empêche les brouillons et les activités rejetées de
    // fuiter dans le catalogue.
    status: ActivityStatus.published,
  }

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

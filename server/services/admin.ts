import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import { toDescription } from '@/server/mappers/activity'
import type { ActivityStatus } from '@/types/activity'
import type {
  AdminOverview,
  ModerationActivity,
  OperatorRequest,
} from '@/types/admin'

// Modération.
//
// C'est le seul endroit du projet qui écrit `User.role`. Aucun autre service ne
// doit le faire : un rôle modifiable ailleurs deviendrait, tôt ou tard, un
// chemin d'auto-promotion.
//
// Et RIEN ici ne fabrique un admin. Le premier — le seul — vient du seed. Un
// endpoint capable de créer un administrateur serait une porte permanente : il
// suffirait d'une faille d'autorisation en amont pour qu'un compte quelconque
// se hisse au sommet.

export async function getOverview(): Promise<AdminOverview> {
  const [
    pendingActivities,
    publishedActivities,
    totalOperators,
    pendingOperators,
    totalBookings,
  ] = await Promise.all([
    db.activity.count({ where: { status: 'pending_moderation' } }),
    db.activity.count({ where: { status: 'published' } }),
    db.operator.count(),
    db.operator.count({ where: { user: { role: 'tourist' } } }),
    db.booking.count({ where: { status: 'confirmed' } }),
  ])

  return {
    pendingActivities,
    pendingOperators,
    publishedActivities,
    totalOperators,
    totalBookings,
  }
}

/**
 * File de modération.
 *
 * Les plus anciennes soumissions d'abord : une file d'attente qui sert les
 * dernières arrivées laisse indéfiniment de côté les opérateurs les moins
 * chanceux.
 */
export async function listActivitiesForModeration(
  status: ActivityStatus,
): Promise<ModerationActivity[]> {
  const rows = await db.activity.findMany({
    where: { status },
    include: {
      operator: true,
      _count: { select: { slots: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 100,
  })

  const upcoming = await db.activitySlot.groupBy({
    by: ['activityId'],
    where: {
      activityId: { in: rows.map((r) => r.id) },
      startsAt: { gte: new Date() },
    },
    _count: { _all: true },
  })
  const upcomingByActivity = new Map(
    upcoming.map((u) => [u.activityId, u._count._all]),
  )

  return rows.map((activity) => ({
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    category: activity.category,
    region: activity.region,
    imageUrl: activity.imageUrls[0] ?? '',
    imageUrls: activity.imageUrls,
    priceHT: activity.priceHt.toNumber(),
    duration: activity.duration,
    maxParticipants: activity.maxParticipants,
    languages: activity.languages,
    included: activity.included,
    excluded: activity.excluded,
    description: toDescription(activity.description),
    status: activity.status as ActivityStatus,
    operatorName: activity.operator.displayName,
    operatorId: activity.operator.id,
    operatorVerified: activity.operator.verified,
    upcomingSlots: upcomingByActivity.get(activity.id) ?? 0,
    submittedAt: activity.updatedAt.toISOString(),
  }))
}

/**
 * Publication.
 *
 * Transition CONDITIONNÉE sur le statut lu : deux admins ouvrant la même file
 * cliqueraient sinon tous les deux, et le second republierait une activité que
 * le premier vient de refuser. `count === 0` ⇒ quelqu'un est passé avant.
 */
export async function publishActivity(activityId: string): Promise<void> {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    select: { id: true },
  })

  if (!activity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activité introuvable.' })
  }

  // Publier une activité sans départ à venir produirait une fiche indexée que
  // personne ne peut réserver.
  const upcoming = await db.activitySlot.count({
    where: { activityId, startsAt: { gte: new Date() } },
  })

  if (upcoming === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cette activité n\'a aucun créneau à venir.',
    })
  }

  const updated = await db.activity.updateMany({
    where: { id: activityId, status: 'pending_moderation' },
    data: { status: 'published' },
  })

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Cette activité a déjà été traitée par un autre administrateur.',
    })
  }
}

export async function rejectActivity(activityId: string): Promise<void> {
  const updated = await db.activity.updateMany({
    // On peut refuser une activité en attente comme en ligne : c'est le
    // dépublication d'urgence quand un contenu problématique est signalé.
    where: {
      id: activityId,
      status: { in: ['pending_moderation', 'published'] },
    },
    data: { status: 'rejected' },
  })

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Cette activité a déjà été traitée.',
    })
  }
}

// ---------------------------------------------------------------------------
// Opérateurs
// ---------------------------------------------------------------------------

export async function listOperatorRequests(): Promise<OperatorRequest[]> {
  const rows = await db.operator.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((operator) => ({
    operatorId: operator.id,
    userId: operator.user.id,
    displayName: operator.displayName,
    userName: operator.user.name,
    userEmail: operator.user.email,
    verified: operator.verified,
    role: operator.user.role,
    activityCount: operator._count.activities,
    requestedAt: operator.createdAt.toISOString(),
  }))
}

/**
 * Validation d'un opérateur : le SEUL chemin vers le rôle `operator`.
 *
 * Les deux écritures sont dans une transaction. Séparées, un incident entre
 * elles laisserait un profil marqué vérifié dont le titulaire ne peut pas
 * accéder à son espace — ou l'inverse, un rôle opérateur sans badge.
 */
export async function approveOperator(operatorId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: operatorId },
      include: { user: { select: { id: true, role: true } } },
    })

    if (!operator) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
    }

    await tx.operator.update({
      where: { id: operatorId },
      data: { verified: true },
    })

    // Un admin qui gère aussi des activités garde son rôle : le rétrograder en
    // `operator` lui ferait perdre l'accès à cette page au clic suivant.
    if (operator.user.role !== 'admin') {
      await tx.user.update({
        where: { id: operator.user.id },
        data: { role: 'operator' },
      })
    }
  })
}

/**
 * Révocation : retire le badge, rétrograde en `tourist`, et dépublie tout.
 *
 * Laisser les activités en ligne après avoir révoqué leur auteur viderait la
 * révocation de son sens — c'est précisément le contenu qu'on veut retirer.
 * Elles passent en `archived` et non supprimées : les réservations déjà prises
 * doivent rester honorables.
 */
export async function revokeOperator(operatorId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: operatorId },
      include: { user: { select: { id: true, role: true } } },
    })

    if (!operator) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
    }

    // Un admin ne se révoque pas via cette porte : ce serait le seul moyen de
    // retirer les droits d'un administrateur depuis l'interface, sans traçage
    // ni garde-fou.
    if (operator.user.role === 'admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Un compte administrateur ne se révoque pas ici.',
      })
    }

    await tx.operator.update({
      where: { id: operatorId },
      data: { verified: false },
    })

    await tx.user.update({
      where: { id: operator.user.id },
      data: { role: 'tourist' },
    })

    await tx.activity.updateMany({
      where: { operatorId, status: { in: ['published', 'pending_moderation'] } },
      data: { status: 'archived' },
    })
  })
}

import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import {
  fromMauritiusWallClock,
  mauritiusDate,
  mauritiusTime,
} from '@/lib/datetime'
import type { ActivityInput, SlotInput } from '@/lib/schemas/operator'
import {
  toActivityWriteData,
  uniqueSlug,
} from '@/server/services/activity-write'
import {
  toOperatorActivityDetail,
  toOperatorActivitySummary,
  toOperatorBookingRow,
  toOperatorProfile,
} from '@/server/mappers/operator'
import type {
  OperatorActivityDetail,
  OperatorActivitySummary,
  OperatorBookingsPage,
  OperatorProfile,
  OperatorStats,
  UpcomingDeparture,
} from '@/types/operator'

// Espace opérateur.
//
// RÈGLE NON NÉGOCIABLE : chaque requête de ce fichier porte
// `operatorId: <celui du contexte>` dans son WHERE — y compris les lectures par
// id. Un opérateur ne doit jamais atteindre les données d'un autre en devinant
// un cuid. Le filtre est dans la clause SQL, pas dans un `if` après coup :
// une vérification post-lecture aurait déjà chargé la donnée d'autrui.

const BOOKINGS_PER_PAGE = 20

/** Charge une activité en garantissant qu'elle appartient à cet opérateur. */
async function ownedActivity(operatorId: string, activityId: string) {
  const activity = await db.activity.findFirst({
    where: { id: activityId, operatorId },
    select: { id: true, status: true, title: true },
  })

  if (!activity) {
    // NOT_FOUND et non FORBIDDEN : répondre « interdit » confirmerait
    // l'existence de l'activité d'un concurrent.
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activité introuvable.' })
  }

  return activity
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function getOperatorStats(
  operatorId: string,
): Promise<OperatorStats> {
  const now = new Date()

  const [aggregate, upcomingSlots] = await Promise.all([
    db.booking.aggregate({
      where: {
        status: 'confirmed',
        slot: { activity: { operatorId } },
      },
      _count: { _all: true },
      _sum: { totalPrice: true, depositDue: true },
    }),
    db.activitySlot.findMany({
      where: { activity: { operatorId }, startsAt: { gte: now } },
      select: { maxSpots: true, spotsTaken: true },
    }),
  ])

  const offered = upcomingSlots.reduce((sum, s) => sum + s.maxSpots, 0)
  const sold = upcomingSlots.reduce((sum, s) => sum + s.spotsTaken, 0)

  return {
    totalBookings: aggregate._count._all,
    totalRevenue: aggregate._sum.totalPrice?.toNumber() ?? 0,
    // La plateforme encaisse l'acompte, l'opérateur le solde sur place.
    platformFee: aggregate._sum.depositDue?.toNumber() ?? 0,
    // Division gardée : sans créneau à venir, le taux n'a pas de sens — 0
    // plutôt que NaN, qui traverserait le JSON et casserait l'affichage.
    occupancyRate: offered === 0 ? 0 : Math.round((sold / offered) * 100),
    upcomingDepartures: upcomingSlots.length,
  }
}

export async function listOperatorActivities(
  operatorId: string,
): Promise<OperatorActivitySummary[]> {
  const activities = await db.activity.findMany({
    where: { operatorId, status: { not: 'archived' } },
    include: { category: true, _count: { select: { slots: true } } },
    orderBy: { createdAt: 'desc' },
  })

  if (activities.length === 0) return []

  // Le nombre de réservations par activité en UNE requête groupée, plutôt
  // qu'un `_count` imbriqué par créneau qu'il faudrait ensuite additionner.
  // Groupé sur `bookings.activityId`, que le lot B a rendu obligatoire. Le
  // détour par le créneau qu'il fallait faire auparavant aurait laissé les
  // locations à la journée hors du compte : l'opérateur aurait vu « 0
  // réservation » sur une voiture pourtant louée.
  const counts = await db.booking.groupBy({
    by: ['activityId'],
    where: {
      // « Créée » compte : la place est retenue dès la réservation, bien avant
      // que l'opérateur valide. L'exclure ferait afficher au prestataire moins
      // de réservations que son créneau n'en a réellement.
      status: { in: ['pending_validation', 'confirmed', 'completed'] },
      activityId: { in: activities.map((a) => a.id) },
    },
    _count: { _all: true },
  })

  const bookingsByActivity = new Map(
    counts.map((row) => [row.activityId, row._count._all]),
  )

  return activities.map((activity) =>
    toOperatorActivitySummary({
      ...activity,
      bookingsCount: bookingsByActivity.get(activity.id) ?? 0,
    }),
  )
}

export async function getOperatorActivity(
  operatorId: string,
  activityId: string,
): Promise<OperatorActivityDetail> {
  const activity = await db.activity.findFirst({
    // Filtre par operatorId MÊME en lecture par id : c'est précisément le cas
    // où l'oubli passerait inaperçu en test manuel.
    where: { id: activityId, operatorId },
    include: {
      category: true,
      slots: {
        orderBy: { startsAt: 'asc' },
        include: { _count: { select: { bookings: true } } },
      },
    },
  })

  if (!activity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activité introuvable.' })
  }

  return toOperatorActivityDetail(activity)
}

export async function listOperatorBookings(
  operatorId: string,
  page: number,
): Promise<OperatorBookingsPage> {
  // Filtré sur `activity` directement, plus par le créneau : sans quoi un
  // loueur ne verrait aucune de ses locations à la journée.
  const where = { activity: { operatorId } }

  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: { user: true, activity: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * BOOKINGS_PER_PAGE,
      take: BOOKINGS_PER_PAGE,
    }),
    db.booking.count({ where }),
  ])

  return {
    bookings: rows.map(toOperatorBookingRow),
    total,
    pages: Math.max(1, Math.ceil(total / BOOKINGS_PER_PAGE)),
  }
}

/** Départs à venir, du plus proche au plus lointain — le planning du jour. */
export async function listUpcomingDepartures(
  operatorId: string,
  limit = 10,
): Promise<UpcomingDeparture[]> {
  const slots = await db.activitySlot.findMany({
    where: {
      activity: { operatorId },
      startsAt: { gte: new Date() },
      // Un créneau sans personne n'est pas un départ : l'afficher noierait les
      // vrais dans une liste de créneaux vides.
      spotsTaken: { gt: 0 },
    },
    include: { activity: { select: { title: true } } },
    orderBy: { startsAt: 'asc' },
    take: limit,
  })

  return slots.map((slot) => ({
    slotId: slot.id,
    activityTitle: slot.activity.title,
    date: mauritiusDate(slot.startsAt),
    time: mauritiusTime(slot.startsAt),
    participants: slot.spotsTaken,
    maxSpots: slot.maxSpots,
  }))
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export async function createActivity(
  operatorId: string,
  input: ActivityInput,
): Promise<OperatorActivityDetail> {
  const activity = await db.activity.create({
    data: {
      ...toActivityWriteData(input),
      operatorId,
      slug: await uniqueSlug(input.title),
      // TOUJOURS en brouillon. Le statut n'est pas dans l'input : une activité
      // ne peut atteindre le catalogue que par la modération (lot 8).
      status: 'draft',
    },
    include: {
      category: true,
      slots: { include: { _count: { select: { bookings: true } } } },
    },
  })

  return toOperatorActivityDetail(activity)
}

export async function updateActivity(
  operatorId: string,
  activityId: string,
  input: ActivityInput,
): Promise<OperatorActivityDetail> {
  await ownedActivity(operatorId, activityId)

  // Le statut ne bouge PAS.
  //
  // Une modification renvoyait la fiche en `pending_moderation` — la garantie
  // qu'un opérateur ne fasse pas valider un texte anodin pour le remplacer
  // ensuite. Cette file n'existe plus au lot 1 : conserver la règle ferait
  // disparaître du catalogue toute fiche corrigée, sans que rien ne l'y
  // ramène. C'est exactement le même raisonnement que pour l'édition depuis
  // `/admin/activities`, qui ne remet pas non plus en modération.
  //
  // Le contrôle a posteriori le remplace : Trip4mauritius voit tout le
  // catalogue et peut dépublier depuis le back-office.
  await db.activity.update({
    where: { id: activityId },
    data: toActivityWriteData(input),
  })

  return getOperatorActivity(operatorId, activityId)
}

/**
 * Met un brouillon en ligne.
 *
 * S'appelait `submitForModeration` et posait `pending_moderation` : il n'y a
 * plus de file d'attente au lot 1, la fiche part donc directement en
 * `published`. Trip4mauritius corrige après coup depuis `/admin/activities`,
 * qui édite la fiche de n'importe quel opérateur.
 *
 * Le contrôle des créneaux, lui, reste — c'était la vraie raison d'être de
 * cette fonction. Une fiche publiée sans départ à venir est indexée par les
 * moteurs et réservable par personne.
 */
export async function publishOwnActivity(
  operatorId: string,
  activityId: string,
): Promise<OperatorActivityDetail> {
  const existing = await ownedActivity(operatorId, activityId)

  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Seul un brouillon peut être mis en ligne.',
    })
  }

  const slots = await db.activitySlot.count({
    where: { activityId, startsAt: { gte: new Date() } },
  })

  if (slots === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ajoutez au moins un créneau à venir avant de mettre en ligne.',
    })
  }

  await db.activity.update({
    where: { id: activityId },
    data: { status: 'published' },
  })

  return getOperatorActivity(operatorId, activityId)
}

/**
 * Archive — on ne supprime jamais.
 *
 * `activities → slots` est en CASCADE et `slots → bookings` en RESTRICT :
 * supprimer une activité réservée casserait sur une contrainte de clé
 * étrangère. L'archivage la sort du catalogue en laissant les réservations
 * passées intactes.
 */
export async function archiveActivity(
  operatorId: string,
  activityId: string,
): Promise<void> {
  await ownedActivity(operatorId, activityId)
  await db.activity.update({
    where: { id: activityId },
    data: { status: 'archived' },
  })
}

export async function createSlots(
  operatorId: string,
  activityId: string,
  slots: SlotInput[],
): Promise<OperatorActivityDetail> {
  await ownedActivity(operatorId, activityId)

  const now = Date.now()
  const rows = slots.map((slot) => {
    const [year, month, day] = slot.date.split('-').map(Number)
    const [hour, minute] = slot.time.split(':').map(Number)
    // Heure MURALE mauricienne → instant UTC. Sans cette conversion, un
    // opérateur saisissant 09:00 depuis un navigateur réglé sur Paris
    // enregistrerait un départ à 11:00 heure de Maurice.
    const startsAt = fromMauritiusWallClock(year, month, day, hour, minute)

    if (startsAt.getTime() <= now) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Le créneau du ${slot.date} à ${slot.time} est déjà passé.`,
      })
    }

    return { activityId, startsAt, maxSpots: slot.maxSpots }
  })

  await db.activitySlot.createMany({
    data: rows,
    // `@@unique([activityId, startsAt])` : réimporter un planning qui recouvre
    // partiellement l'existant est un geste normal, pas une erreur à remonter.
    skipDuplicates: true,
  })

  return getOperatorActivity(operatorId, activityId)
}

export async function deleteSlot(
  operatorId: string,
  slotId: string,
): Promise<void> {
  const slot = await db.activitySlot.findFirst({
    where: { id: slotId, activity: { operatorId } },
    include: { _count: { select: { bookings: true } } },
  })

  if (!slot) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Créneau introuvable.' })
  }

  if (slot._count.bookings > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        'Ce créneau a des réservations : annulez-les avant de le supprimer.',
    })
  }

  await db.activitySlot.delete({ where: { id: slotId } })
}

export async function updateOperatorProfile(
  operatorId: string,
  input: { displayName: string; avatarUrl?: string },
): Promise<OperatorProfile> {
  const operator = await db.operator.update({
    where: { id: operatorId },
    data: {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl?.trim() || null,
    },
  })

  return toOperatorProfile(operator)
}

/** Profil opérateur du compte, ou `null` si l'admin ne l'a pas créé. */
export async function getMyOperatorProfile(
  userId: string,
): Promise<(OperatorProfile & { role: string }) | null> {
  const operator = await db.operator.findUnique({
    where: { userId },
    include: { user: { select: { role: true } } },
  })

  if (!operator) return null

  return { ...toOperatorProfile(operator), role: operator.user.role }
}

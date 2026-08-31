import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import {
  fromMauritiusWallClock,
  mauritiusDate,
  mauritiusTime,
} from '@/lib/datetime'
import type { ActivityInput, SlotInput } from '@/lib/schemas/operator'
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

/** Slug URL à partir du titre : minuscules, sans accents ni ponctuation. */
function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Slug unique.
 *
 * `slug` est en UNIQUE : deux opérateurs qui nomment leur sortie « Catamaran
 * Nord » se heurteraient sur une erreur Prisma incompréhensible. On suffixe
 * jusqu'à trouver libre. La boucle est bornée — au-delà, un aléa vaut mieux
 * qu'un blocage.
 */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'activite'

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const taken = await db.activity.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }

  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

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
    include: { _count: { select: { slots: true } } },
    orderBy: { createdAt: 'desc' },
  })

  if (activities.length === 0) return []

  // Le nombre de réservations par activité en UNE requête groupée, plutôt
  // qu'un `_count` imbriqué par créneau qu'il faudrait ensuite additionner.
  const counts = await db.booking.groupBy({
    by: ['slotId'],
    where: {
      status: { in: ['confirmed', 'completed'] },
      slot: { activityId: { in: activities.map((a) => a.id) } },
    },
    _count: { _all: true },
  })

  const slots = await db.activitySlot.findMany({
    where: { id: { in: counts.map((c) => c.slotId) } },
    select: { id: true, activityId: true },
  })
  const activityBySlot = new Map(slots.map((s) => [s.id, s.activityId]))

  const bookingsByActivity = new Map<string, number>()
  for (const row of counts) {
    const activityId = activityBySlot.get(row.slotId)
    if (!activityId) continue
    bookingsByActivity.set(
      activityId,
      (bookingsByActivity.get(activityId) ?? 0) + row._count._all,
    )
  }

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
  const where = { slot: { activity: { operatorId } } }

  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: { user: true, slot: { include: { activity: true } } },
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
      operatorId,
      slug: await uniqueSlug(input.title),
      title: input.title,
      category: input.category,
      region: input.region,
      duration: input.duration,
      priceHt: input.priceHT,
      maxParticipants: input.maxParticipants,
      languages: input.languages,
      imageUrls: input.imageUrls,
      included: input.included,
      excluded: input.excluded,
      description: input.description,
      // TOUJOURS en brouillon. Le statut n'est pas dans l'input : une activité
      // ne peut atteindre le catalogue que par la modération (lot 8).
      status: 'draft',
    },
    include: { slots: { include: { _count: { select: { bookings: true } } } } },
  })

  return toOperatorActivityDetail(activity)
}

export async function updateActivity(
  operatorId: string,
  activityId: string,
  input: ActivityInput,
): Promise<OperatorActivityDetail> {
  const existing = await ownedActivity(operatorId, activityId)

  // Modifier une activité publiée la renvoie en modération : sinon un opérateur
  // ferait valider un texte anodin puis le remplacerait une fois en ligne.
  const status =
    existing.status === 'published' || existing.status === 'rejected'
      ? 'pending_moderation'
      : existing.status

  await db.activity.update({
    where: { id: activityId },
    data: {
      title: input.title,
      category: input.category,
      region: input.region,
      duration: input.duration,
      priceHt: input.priceHT,
      maxParticipants: input.maxParticipants,
      languages: input.languages,
      imageUrls: input.imageUrls,
      included: input.included,
      excluded: input.excluded,
      description: input.description,
      status,
    },
  })

  return getOperatorActivity(operatorId, activityId)
}

/** Soumet un brouillon à la modération. */
export async function submitForModeration(
  operatorId: string,
  activityId: string,
): Promise<OperatorActivityDetail> {
  const existing = await ownedActivity(operatorId, activityId)

  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Seuls un brouillon ou une activité refusée peuvent être soumis.',
    })
  }

  // Publier une activité sans créneau produirait une fiche que personne ne peut
  // réserver — autant l'arrêter avant la file de modération.
  const slots = await db.activitySlot.count({
    where: { activityId, startsAt: { gte: new Date() } },
  })

  if (slots === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ajoutez au moins un créneau à venir avant de soumettre.',
    })
  }

  await db.activity.update({
    where: { id: activityId },
    data: { status: 'pending_moderation' },
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

// ---------------------------------------------------------------------------
// Devenir opérateur
// ---------------------------------------------------------------------------

/**
 * Demande d'accès opérateur.
 *
 * Crée le profil `Operator` en `verified: false` SANS toucher au rôle : la
 * bascule en `operator` est le geste d'un admin (lot 8). Laisser cette
 * procédure promouvoir son appelant en ferait un endpoint d'auto-promotion.
 */
export async function requestOperatorAccess(
  userId: string,
  displayName: string,
): Promise<OperatorProfile> {
  const existing = await db.operator.findUnique({ where: { userId } })

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Une demande est déjà enregistrée pour ce compte.',
    })
  }

  const operator = await db.operator.create({
    data: { userId, displayName, verified: false },
  })

  return toOperatorProfile(operator)
}

/** Profil opérateur du compte, ou `null` s'il n'a jamais fait de demande. */
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

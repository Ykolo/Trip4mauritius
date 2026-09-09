import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fromMauritiusWallClock } from '@/lib/datetime'
import type {
  AdminActivitiesInput,
  AdminActivityStatus,
} from '@/lib/schemas/admin'
import type { ActivityInput, SlotInput } from '@/lib/schemas/operator'
import {
  toOperatorActivityDetail,
  toOperatorActivitySummary,
} from '@/server/mappers/operator'
import {
  assertPublishable,
  toActivityWriteData,
  uniqueSlug,
} from '@/server/services/activity-write'
import type { ActivityStatus } from '@/types/activity'
import type {
  AdminActivitiesPage,
  AdminActivityDetail,
  AdminOperatorOption,
} from '@/types/admin'

// Gestion du catalogue par l'admin.
//
// Trois écarts délibérés avec `server/services/operator.ts`, et aucun autre :
//
// 1. AUCUN filtre `operatorId` dans les WHERE. C'est l'exact inverse de la
//    règle opérateur, et c'est voulu : le back-office voit tout le catalogue.
//    D'où un fichier séparé — glisser ces requêtes dans `operator.ts` aurait mis
//    côte à côte des lectures filtrées et des lectures ouvertes, et la prochaine
//    copier-coller aurait pris la mauvaise.
//
// 2. Modifier une fiche PUBLIÉE ne la renvoie PAS en modération. Un opérateur
//    est renvoyé en file parce qu'il pourrait faire valider un texte anodin puis
//    le remplacer. L'admin est la file : s'auto-adresser une demande de
//    validation ne protège de rien et sortirait la fiche du catalogue à chaque
//    correction de faute de frappe.
//
// 3. Le statut se pose directement (`setActivityStatus`) au lieu de passer par
//    `publishActivity`. Cette dernière reste INTACTE et garde sa garde sur
//    `pending_moderation` : c'est le geste de modération sur la soumission d'un
//    opérateur. Une fiche saisie par l'admin ne traverse jamais cet état, et
//    élargir la garde de `publishActivity` aurait au passage rendu publiables
//    les brouillons privés des opérateurs — que la file exclut exprès.

const ROWS_PER_PAGE = 20

/** Charge une activité sans filtre de propriétaire, ou 404. */
async function existingActivity(activityId: string) {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    select: { id: true, status: true },
  })

  if (!activity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activité introuvable.' })
  }

  return activity
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Le catalogue entier, filtrable.
 *
 * `archived` n'est pas masqué par défaut, contrairement au listing opérateur :
 * l'admin est précisément celui qui a besoin de retrouver une fiche retirée
 * pour la remettre en ligne.
 */
export async function listActivitiesForAdmin(
  filters: AdminActivitiesInput,
): Promise<AdminActivitiesPage> {
  const where: Prisma.ActivityWhereInput = {}

  if (filters.status !== 'all') where.status = filters.status
  if (filters.operatorId) where.operatorId = filters.operatorId

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { slug: { contains: filters.search, mode: 'insensitive' } },
      {
        operator: {
          displayName: { contains: filters.search, mode: 'insensitive' },
        },
      },
    ]
  }

  const [rows, total] = await Promise.all([
    db.activity.findMany({
      where,
      include: {
        category: true,
        operator: { select: { id: true, displayName: true } },
        _count: { select: { slots: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * ROWS_PER_PAGE,
      take: ROWS_PER_PAGE,
    }),
    db.activity.count({ where }),
  ])

  // Les départs à venir en UNE requête groupée plutôt qu'un compte par ligne :
  // vingt fiches faisaient vingt allers-retours.
  const upcoming =
    rows.length === 0
      ? []
      : await db.activitySlot.groupBy({
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

  return {
    activities: rows.map((activity) => ({
      ...toOperatorActivitySummary(activity),
      operatorId: activity.operator.id,
      operatorName: activity.operator.displayName,
      upcomingSlots: upcomingByActivity.get(activity.id) ?? 0,
      updatedAt: activity.updatedAt.toISOString(),
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ROWS_PER_PAGE)),
  }
}

export async function getActivityForAdmin(
  activityId: string,
): Promise<AdminActivityDetail> {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    include: {
      category: true,
      operator: { select: { id: true, displayName: true } },
      slots: {
        orderBy: { startsAt: 'asc' },
        include: { _count: { select: { bookings: true } } },
      },
    },
  })

  if (!activity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activité introuvable.' })
  }

  return {
    ...toOperatorActivityDetail(activity),
    operatorId: activity.operator.id,
    operatorName: activity.operator.displayName,
  }
}

/**
 * Opérateurs proposables à la création.
 *
 * Non vérifiés inclus, avec le drapeau : au lancement, l'admin saisit le
 * catalogue pour des enseignes qui n'ont pas encore de compte validé. Les
 * masquer aurait rendu la création impossible tant que personne n'est approuvé.
 *
 * Les DÉSACTIVÉS, eux, sont exclus — c'est la différence entre « pas encore
 * approuvé » et « ne travaille plus avec nous ». Les laisser proposer ici
 * permettrait de créer une fiche neuve chez un prestataire dont on vient
 * d'archiver tout le catalogue.
 */
export async function listOperatorOptions(): Promise<AdminOperatorOption[]> {
  const operators = await db.operator.findMany({
    where: { active: true },
    include: { _count: { select: { activities: true } } },
    orderBy: { displayName: 'asc' },
  })

  return operators.map((operator) => ({
    id: operator.id,
    displayName: operator.displayName,
    verified: operator.verified,
    activityCount: operator._count.activities,
  }))
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export async function createActivityForAdmin(
  operatorId: string,
  input: ActivityInput,
): Promise<AdminActivityDetail> {
  // Vérifié AVANT l'insertion : un operatorId inventé casserait sur la clé
  // étrangère, avec un message Prisma que l'admin ne peut pas interpréter.
  const operator = await db.operator.findUnique({
    where: { id: operatorId },
    select: { id: true },
  })

  if (!operator) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
  }

  const activity = await db.activity.create({
    data: {
      ...toActivityWriteData(input),
      operatorId,
      slug: await uniqueSlug(input.title),
      // Brouillon, comme côté opérateur. La mise en ligne est un second geste
      // explicite : elle exige au moins un créneau à venir, qu'une fiche
      // fraîchement créée n'a par construction pas encore.
      status: 'draft',
    },
    select: { id: true },
  })

  return getActivityForAdmin(activity.id)
}

export async function updateActivityForAdmin(
  activityId: string,
  input: ActivityInput,
): Promise<AdminActivityDetail> {
  await existingActivity(activityId)

  await db.activity.update({
    where: { id: activityId },
    // Pas de `status` : corriger un texte ne change pas l'état de publication.
    // Voir l'écart n°2 en tête de fichier.
    data: toActivityWriteData(input),
  })

  return getActivityForAdmin(activityId)
}

/**
 * Transitions autorisées, par état cible.
 *
 * Table explicite plutôt qu'une suite de `if` : c'est la liste que l'on relit
 * quand on se demande si l'admin peut ressusciter une fiche archivée (oui) ou
 * republier sans créneau (non, garde plus bas).
 *
 * Elle se lit aujourd'hui « tout état sauf lui-même », et un `{ not: status }`
 * dirait la même chose en une ligne. On garde la table quand même : ce qu'elle
 * énonce, c'est que le graphe est COMPLET — chaque case a été regardée. Le
 * raccourci, lui, autoriserait d'office toute transition vers un état futur,
 * sans que personne n'ait eu à se prononcer.
 */
const ALLOWED_FROM: Record<AdminActivityStatus, ActivityStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft', 'published'],
}

export async function setActivityStatusForAdmin(
  activityId: string,
  status: AdminActivityStatus,
): Promise<AdminActivityDetail> {
  await existingActivity(activityId)

  // Même règle que `publishOwnActivity`, et déclarée au même endroit : elle
  // dépend du mode de vente, et une location à la journée n'a aucun créneau.
  if (status === 'published') {
    await assertPublishable(activityId)
  }

  // Transition CONDITIONNÉE sur l'état lu, comme la file de modération : deux
  // admins sur le même écran ne doivent pas pouvoir republier une fiche que
  // l'autre vient d'archiver.
  const updated = await db.activity.updateMany({
    where: { id: activityId, status: { in: ALLOWED_FROM[status] } },
    data: { status },
  })

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Cette activité est déjà dans cet état, ou vient d\'être modifiée.',
    })
  }

  return getActivityForAdmin(activityId)
}

// ---------------------------------------------------------------------------
// Créneaux
// ---------------------------------------------------------------------------
//
// Sans eux, la création de fiches par l'admin ne sert à rien : une activité
// sans créneau n'est ni publiable (garde ci-dessus) ni réservable.

export async function createSlotsForAdmin(
  activityId: string,
  slots: SlotInput[],
): Promise<AdminActivityDetail> {
  await existingActivity(activityId)

  const now = Date.now()
  const rows = slots.map((slot) => {
    const [year, month, day] = slot.date.split('-').map(Number)
    const [hour, minute] = slot.time.split(':').map(Number)
    // Heure MURALE mauricienne → instant UTC. Un admin qui saisit 09:00 depuis
    // un navigateur réglé sur Paris enregistrerait sinon un départ à 11:00
    // heure de Maurice.
    const startsAt = fromMauritiusWallClock(year, month, day, hour, minute)

    if (startsAt.getTime() <= now) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Le créneau du ${slot.date} à ${slot.time} est déjà passé.`,
      })
    }

    return { activityId, startsAt, maxSpots: slot.maxSpots }
  })

  await db.activitySlot.createMany({ data: rows, skipDuplicates: true })

  return getActivityForAdmin(activityId)
}

export async function deleteSlotForAdmin(slotId: string): Promise<void> {
  const slot = await db.activitySlot.findUnique({
    where: { id: slotId },
    include: { _count: { select: { bookings: true } } },
  })

  if (!slot) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Créneau introuvable.' })
  }

  // `slots → bookings` est en RESTRICT. Le dire, plutôt que de laisser remonter
  // une violation de clé étrangère — et surtout ne PAS supprimer les
  // réservations pour faire passer le geste.
  if (slot._count.bookings > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        'Ce créneau a des réservations : annulez-les avant de le supprimer.',
    })
  }

  await db.activitySlot.delete({ where: { id: slotId } })
}

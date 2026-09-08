import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  BOOKING_STATUS_LABEL,
  canAdminMove,
  type AdminSettableStatus,
} from '@/lib/booking-status'
import { mauritiusDate, mauritiusTime } from '@/lib/datetime'
import type { AdminBookingsInput } from '@/lib/schemas/admin'
import type { BookingStatus } from '@/types/cart'
import type {
  AdminBookingsPage,
  AdminOperator,
  AdminOverview,
} from '@/types/admin'

// Administration.
//
// C'est le seul endroit du projet qui écrit `User.role`. Aucun autre service ne
// doit le faire : un rôle modifiable ailleurs deviendrait, tôt ou tard, un
// chemin d'auto-promotion.
//
// Et RIEN ici ne fabrique un admin. Le premier — le seul — vient du seed, tout
// comme le super admin. Un endpoint capable de créer un administrateur serait
// une porte permanente : il suffirait d'une faille d'autorisation en amont pour
// qu'un compte quelconque se hisse au sommet.
//
// ⚠️ Lot 1 : il n'y a PLUS de modération. Le catalogue, les réservations et les
// calendriers sont tenus par Trip4mauritius directement, donc il n'existe ni
// file d'attente d'activités, ni validation d'opérateur. Les valeurs
// `pending_moderation` (enum `ActivityStatus`) et `Operator.verified` restent en
// base mais ne sont plus écrites par personne : les retirer imposerait de
// recréer le type Postgres et de retoucher les contraintes CHECK écrites à la
// main, pour aucun gain fonctionnel.

export async function getOverview(): Promise<AdminOverview> {
  const [
    publishedActivities,
    pendingBookings,
    confirmedBookings,
    totalOperators,
    publishedGuides,
  ] = await Promise.all([
    db.activity.count({ where: { status: 'published' } }),
    // « En attente » = ce sur quoi l'admin doit AGIR : les réservations créées
    // dont l'opérateur n'a pas encore validé la prise en charge. C'était
    // `pending_payment`, un état que personne n'écrit tant que Stripe n'existe
    // pas — le compteur affichait donc invariablement zéro.
    db.booking.count({ where: { status: 'pending_validation' } }),
    db.booking.count({ where: { status: 'confirmed' } }),
    db.operator.count(),
    db.guide.count({ where: { status: 'published' } }),
  ])

  return {
    publishedActivities,
    pendingBookings,
    confirmedBookings,
    totalOperators,
    publishedGuides,
  }
}

const ROWS_PER_PAGE = 20

/**
 * Listing des réservations, toutes plateformes confondues.
 *
 * C'est le seul écran qui voit les réservations de tout le monde, et il expose
 * l'email du touriste comme celui de l'opérateur : la mise en relation est
 * manuelle tant que rien ne l'automatise, et l'alternative était d'ouvrir la
 * base pour retrouver un numéro.
 *
 * L'ordre dépend de la période demandée : sur « à venir », le plus proche
 * d'abord — c'est le départ sur lequel il reste quelque chose à faire. Sur le
 * passé, le plus récent d'abord.
 */
export async function listBookingsForAdmin(
  filters: AdminBookingsInput,
): Promise<AdminBookingsPage> {
  const now = new Date()
  const where: Prisma.BookingWhereInput = {}

  if (filters.status !== 'all') where.status = filters.status

  if (filters.period !== 'all') {
    where.slot = {
      startsAt: filters.period === 'upcoming' ? { gte: now } : { lt: now },
    }
  }

  if (filters.search) {
    // Une référence se cherche telle qu'elle est imprimée (MX-2026-000123),
    // un client par son nom ou son adresse — on ne demande pas à l'admin de
    // choisir dans quel champ il cherche.
    where.OR = [
      { bookingRef: { contains: filters.search, mode: 'insensitive' } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
    ]
  }

  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        user: true,
        slot: {
          include: { activity: { include: { operator: { include: { user: true } } } } },
        },
      },
      orderBy: {
        slot: { startsAt: filters.period === 'upcoming' ? 'asc' : 'desc' },
      },
      skip: (filters.page - 1) * ROWS_PER_PAGE,
      take: ROWS_PER_PAGE,
    }),
    db.booking.count({ where }),
  ])

  return {
    bookings: rows.map((booking) => ({
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status as BookingStatus,
      createdAt: booking.createdAt.toISOString(),

      date: mauritiusDate(booking.slot.startsAt),
      time: mauritiusTime(booking.slot.startsAt),
      departed: booking.slot.startsAt.getTime() < now.getTime(),

      activityTitle: booking.slot.activity.title,
      activitySlug: booking.slot.activity.slug,
      participants: booking.participants,
      totalPrice: booking.totalPrice.toNumber(),
      depositDue: booking.depositDue.toNumber(),
      balanceDueOnSite: booking.balanceDueOnSite.toNumber(),

      touristName: booking.user.name,
      touristEmail: booking.user.email,
      contactPhone: booking.contactPhone,

      operatorId: booking.slot.activity.operator.id,
      operatorName: booking.slot.activity.operator.displayName,
      operatorEmail: booking.slot.activity.operator.user.email,
      operatorWhatsapp: booking.slot.activity.operator.whatsapp,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ROWS_PER_PAGE)),
  }
}

/**
 * Fait avancer une réservation dans son cycle de vie, depuis le back-office.
 *
 * Les transitions autorisées sont déclarées UNE fois, dans
 * `lib/booking-status.ts`, et servent aussi à dessiner les boutons de l'écran.
 * On revalide ici quand même : l'écran ne propose que le permis, mais la
 * procédure est appelable directement — masquer un bouton n'a jamais fermé une
 * porte.
 *
 * Deux choses méritent l'attention :
 *
 * 1. La transition est conditionnée sur le statut LU, dans le `updateMany` —
 *    même schéma que `cancelBooking`. Deux admins sur le même écran, ou un
 *    double-clic, ne doivent pas appliquer deux fois la même transition : la
 *    seconde ne trouverait plus la ligne dans l'état attendu et échouerait
 *    proprement, au lieu de re-libérer des places déjà rendues.
 *
 * 2. Passer à `cancelled` REND les places, dans la même transaction. C'est la
 *    règle de `cancelBooking`, et l'oublier ici aurait fait fuir l'inventaire
 *    par un chemin différent : le créneau se serait rempli d'annulations sans
 *    jamais se revendre.
 */
export async function setBookingStatus(input: {
  bookingId: string
  status: AdminSettableStatus
}): Promise<{ id: string; status: BookingStatus }> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        status: true,
        slotId: true,
        participants: true,
      },
    })

    if (!booking) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation introuvable.' })
    }

    const from = booking.status as BookingStatus

    if (from === input.status) {
      return { id: booking.id, status: from }
    }

    if (!canAdminMove(from, input.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Passage impossible de « ${BOOKING_STATUS_LABEL[from]} » à « ${BOOKING_STATUS_LABEL[input.status]} ».`,
      })
    }

    const moved = await tx.booking.updateMany({
      where: { id: booking.id, status: from },
      data: { status: input.status },
    })

    if (moved.count === 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Cette réservation vient de changer d’état. Rechargez la liste.',
      })
    }

    if (input.status === 'cancelled') {
      // Soustraction franche, sans GREATEST(0, …) : la garde de statut
      // ci-dessus rend le double décrément impossible, et le CHECK
      // `spotsTaken >= 0` doit rester capable de signaler une régression au
      // lieu de l'absorber en silence.
      await tx.$executeRaw`
        UPDATE activity_slots
           SET "spotsTaken" = "spotsTaken" - ${booking.participants}
         WHERE id = ${booking.slotId}
      `
    }

    return { id: booking.id, status: input.status }
  })
}

// ---------------------------------------------------------------------------
// Opérateurs
// ---------------------------------------------------------------------------

export async function listOperators(): Promise<AdminOperator[]> {
  const rows = await db.operator.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((operator) => ({
    operatorId: operator.id,
    userId: operator.user.id,
    displayName: operator.displayName,
    userName: operator.user.name,
    userEmail: operator.user.email,
    whatsapp: operator.whatsapp,
    activityCount: operator._count.activities,
    createdAt: operator.createdAt.toISOString(),
  }))
}

/**
 * Renseigne ou retire le numéro WhatsApp d'un opérateur.
 *
 * Non filtré par opérateur, et c'est voulu : l'admin corrige la fiche de
 * n'importe quel prestataire — même logique que `admin-catalog.ts`. Un
 * opérateur ne peut PAS modifier ce champ depuis son espace : le back-office
 * s'en sert pour le joindre, le laisser le réécrire lui donnerait le moyen de
 * se rendre injoignable en silence.
 *
 * `null` est une valeur légitime : un numéro devenu faux doit pouvoir être
 * effacé, sinon le bouton composerait indéfiniment une ligne coupée.
 */
export async function setOperatorWhatsapp(input: {
  operatorId: string
  whatsapp: string | null
}): Promise<{ whatsapp: string | null }> {
  const updated = await db.operator.update({
    where: { id: input.operatorId },
    data: { whatsapp: input.whatsapp },
    select: { whatsapp: true },
  })

  return updated
}

/**
 * Création d'un opérateur par l'administrateur Trip4mauritius.
 *
 * C'est désormais le SEUL chemin vers le rôle `operator` : l'auto-inscription
 * (`operator.requestAccess`) a disparu avec la modération. Un touriste ne peut
 * plus se déclarer prestataire, il faut passer par ici.
 *
 * Deux cas, une seule transaction :
 *
 * - l'adresse est inconnue → on crée le compte ET son profil. Le compte n'a
 *   AUCUN mot de passe : aucune ligne `account` n'est écrite, donc la connexion
 *   est impossible tant que le titulaire n'a pas utilisé la réinitialisation.
 *   Fabriquer un mot de passe ici obligerait à le transmettre en clair.
 * - l'adresse existe déjà → on promeut ce compte, sans toucher à ses données.
 *
 * Un compte `admin` n'est jamais rétrogradé : ce serait le seul moyen de retirer
 * ses droits à un administrateur depuis l'interface.
 */
export async function createOperator(input: {
  email: string
  name: string
  displayName: string
  whatsapp?: string | null
}): Promise<{ operatorId: string; userCreated: boolean }> {
  const email = input.email.trim().toLowerCase()

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: { operator: { select: { id: true } } },
    })

    if (existing?.operator) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Ce compte est déjà opérateur.',
      })
    }

    const user =
      existing ??
      (await tx.user.create({
        data: {
          email,
          name: input.name.trim(),
          // Pas de vérification d'email dans le projet : la marquer fausse
          // bloquerait la connexion pour une garantie qu'on n'offre pas.
          emailVerified: true,
          role: 'operator',
          locale: 'fr',
        },
      }))

    // On ne RÉTROGRADE jamais. `admin` et `superadmin` conservent leur rôle :
    // les lister ici est le seul rempart, la promotion se fait sinon en
    // silence. Un super admin à qui on crée un profil opérateur se retrouverait
    // sans son accès aux interrupteurs, sans qu'aucun écran ne le signale.
    const PRIVILEGED = ['admin', 'superadmin']

    if (existing && !PRIVILEGED.includes(existing.role) && existing.role !== 'operator') {
      await tx.user.update({ where: { id: user.id }, data: { role: 'operator' } })
    }

    const operator = await tx.operator.create({
      data: {
        userId: user.id,
        displayName: input.displayName.trim(),
        whatsapp: input.whatsapp ?? null,
        // Plus de file de validation : un opérateur créé par l'admin est
        // vérifié par construction. La colonne survit pour l'affichage public.
        verified: true,
      },
    })

    return { operatorId: operator.id, userCreated: existing === null }
  })
}

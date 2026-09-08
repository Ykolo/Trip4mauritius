import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
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
    db.booking.count({ where: { status: 'pending_payment' } }),
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
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ROWS_PER_PAGE)),
  }
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
    activityCount: operator._count.activities,
    createdAt: operator.createdAt.toISOString(),
  }))
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
        // Plus de file de validation : un opérateur créé par l'admin est
        // vérifié par construction. La colonne survit pour l'affichage public.
        verified: true,
      },
    })

    return { operatorId: operator.id, userCreated: existing === null }
  })
}

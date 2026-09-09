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
    // `booking.startsAt` et non `slot.startsAt` : une location à la journée n'a
    // pas de créneau, et un filtre passant par la relation l'aurait exclue du
    // listing sans que rien ne le signale.
    where.startsAt = filters.period === 'upcoming' ? { gte: now } : { lt: now }
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
        activity: { include: { operator: { include: { user: true } } } },
      },
      orderBy: { startsAt: filters.period === 'upcoming' ? 'asc' : 'desc' },
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

      mode: booking.slotId === null ? ('daily' as const) : ('slot' as const),
      date: mauritiusDate(booking.startsAt),
      time: mauritiusTime(booking.startsAt),
      endDate: booking.endsAt ? mauritiusDate(booking.endsAt) : null,
      endTime: booking.endsAt ? mauritiusTime(booking.endsAt) : null,
      billedDays: booking.billedDays,
      departed: booking.startsAt.getTime() < now.getTime(),

      activityTitle: booking.activity.title,
      activitySlug: booking.activity.slug,
      participants: booking.participants,
      totalPrice: booking.totalPrice.toNumber(),
      depositDue: booking.depositDue.toNumber(),
      balanceDueOnSite: booking.balanceDueOnSite.toNumber(),

      touristName: booking.user.name,
      touristEmail: booking.user.email,
      contactPhone: booking.contactPhone,

      operatorId: booking.activity.operator.id,
      operatorName: booking.activity.operator.displayName,
      operatorEmail: booking.activity.operator.user.email,
      operatorWhatsapp: booking.activity.operator.whatsapp,
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

    // Rendre les places, UNIQUEMENT en mode créneau. Une location à la journée
    // n'a pas de compteur à recréditer : sa période redevient libre du seul
    // fait que le statut n'est plus actif, puisque la disponibilité s'y calcule
    // en comptant les réservations actives qui chevauchent.
    if (input.status === 'cancelled' && booking.slotId !== null) {
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

  // Comptage des réservations en DEUX requêtes, pas une par opérateur : le
  // listing n'est pas paginé, et un `count` par ligne ferait autant
  // d'allers-retours vers Neon qu'il y a de prestataires.
  //
  // Le regroupement se fait sur `bookings.activityId`, que le lot B a rendu
  // obligatoire. Il fallait auparavant passer par le créneau — et ce détour
  // aurait laissé les locations à la journée hors du compte, donc rendu
  // supprimable un loueur qui a vendu.
  const counts = await db.booking.groupBy({
    by: ['activityId'],
    _count: { _all: true },
    where: { activity: { operatorId: { in: rows.map((o) => o.id) } } },
  })

  const owners = await db.activity.findMany({
    where: { id: { in: counts.map((c) => c.activityId) } },
    select: { id: true, operatorId: true },
  })

  const ownerByActivity = new Map(owners.map((a) => [a.id, a.operatorId]))

  // `groupBy` ne remonte que les activités qui ont au moins une réservation —
  // d'où le `?? 0` à la lecture, et non une Map pré-remplie qui laisserait
  // croire que la valeur manquante est une anomalie.
  const bookingsByOperator = new Map<string, number>()
  for (const row of counts) {
    const operatorId = ownerByActivity.get(row.activityId)
    if (!operatorId) continue
    bookingsByOperator.set(
      operatorId,
      (bookingsByOperator.get(operatorId) ?? 0) + row._count._all,
    )
  }

  return rows.map((operator) => {
    const bookingCount = bookingsByOperator.get(operator.id) ?? 0

    return {
      operatorId: operator.id,
      userId: operator.user.id,
      displayName: operator.displayName,
      userName: operator.user.name,
      userEmail: operator.user.email,
      whatsapp: operator.whatsapp,
      avatarUrl: operator.avatarUrl,
      activityCount: operator._count.activities,
      bookingCount,
      // La règle est DÉRIVÉE ici et nulle part ailleurs. `deleteOperator` la
      // revérifie dans sa transaction : cette valeur-ci sert à dessiner le bon
      // bouton, pas à autoriser quoi que ce soit.
      deletable: bookingCount === 0,
      active: operator.active,
      createdAt: operator.createdAt.toISOString(),
    }
  })
}

/**
 * Rôles qu'aucun chemin de ce fichier ne RÉTROGRADE, jamais.
 *
 * Déclaré une seule fois : la garde vit dans quatre fonctions, et une liste
 * recopiée qui perdrait `superadmin` retirerait à Kled son accès aux
 * interrupteurs de fonctionnalité — en silence, au détour d'une désactivation
 * d'opérateur.
 */
const PRIVILEGED_ROLES = ['admin', 'superadmin']

/**
 * Édite la fiche d'un opérateur : identité commerciale, contact, coordonnées.
 *
 * Non filtré par opérateur, et c'est voulu : l'admin corrige la fiche de
 * n'importe quel prestataire — même logique que `admin-catalog.ts`. Un
 * opérateur ne peut PAS modifier son WhatsApp depuis son espace : le
 * back-office s'en sert pour le joindre, le laisser le réécrire lui donnerait
 * le moyen de se rendre injoignable en silence.
 *
 * Deux tables en une transaction : le nom commercial et les coordonnées vivent
 * sur `Operator`, l'identité réelle et l'adresse de connexion sur `User`. Les
 * écrire séparément laisserait, en cas d'incident, un opérateur renommé dont le
 * compte porte encore l'ancienne adresse.
 *
 * `role` n'est JAMAIS touché ici : éditer une fiche n'est pas changer des
 * droits.
 */
export async function updateOperator(input: {
  operatorId: string
  email: string
  name: string
  displayName: string
  whatsapp?: string | null
  avatarUrl?: string | null
}): Promise<{ operatorId: string }> {
  // Normalisée ICI et pas seulement par Zod : les services sont écrits une fois
  // et consommés aussi bien par les routers tRPC que directement (RSC, tests).
  // S'en remettre à la validation d'entrée laisserait une `Contact@Exemple.MU`
  // entrer par un chemin et pas par l'autre — deux comptes pour une adresse.
  const email = input.email.trim().toLowerCase()

  return db.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true, userId: true },
    })

    if (!operator) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
    }

    // Collision d'adresse rattrapée AVANT l'écriture, pour dire laquelle pose
    // problème. L'unicité en base la refuserait aussi, mais avec un message
    // Prisma que personne ne peut agir.
    const clash = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (clash && clash.id !== operator.userId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `L'adresse ${email} appartient déjà à un autre compte.`,
      })
    }

    await tx.operator.update({
      where: { id: operator.id },
      data: {
        displayName: input.displayName.trim(),
        whatsapp: input.whatsapp ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
    })

    await tx.user.update({
      where: { id: operator.userId },
      data: { name: input.name.trim(), email },
    })

    return { operatorId: operator.id }
  })
}

/**
 * Supprime un opérateur — UNIQUEMENT s'il n'a jamais rien vendu.
 *
 * C'est le cas de l'opérateur créé par erreur, qu'il serait absurde de garder à
 * vie dans la liste. Dès qu'une réservation existe, la suppression est refusée
 * et l'écran bascule sur `setOperatorActive` : `slots → bookings` est en
 * RESTRICT, et passer outre effacerait l'historique de touristes qui n'ont rien
 * demandé.
 *
 * Le comptage est refait ICI, dans la transaction, et pas seulement affiché par
 * `listOperators` : entre le chargement de la liste et le clic, une réservation
 * a pu tomber. C'est ce recomptage qui autorise, pas le booléen du front.
 *
 * Le compte `User`, lui, SURVIT — rétrogradé en `tourist`. Il peut porter des
 * réservations en tant que touriste (`bookings → user` est en RESTRICT), et
 * supprimer un compte pour retirer un rôle serait hors de proportion.
 */
export async function deleteOperator(input: {
  operatorId: string
}): Promise<{ userId: string; deletedActivities: number }> {
  return db.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true, userId: true, user: { select: { role: true } } },
    })

    if (!operator) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
    }

    const bookings = await tx.booking.count({
      where: { slot: { activity: { operatorId: operator.id } } },
    })

    if (bookings > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Cet opérateur porte ${bookings} réservation${bookings > 1 ? 's' : ''} : il ne peut pas être supprimé. Désactivez-le pour archiver ses activités en conservant l'historique.`,
      })
    }

    // CASCADE emporte les créneaux avec les activités ; aucune réservation ne
    // les retient, on vient de le vérifier sous transaction.
    const deleted = await tx.activity.deleteMany({
      where: { operatorId: operator.id },
    })

    await tx.operator.delete({ where: { id: operator.id } })

    if (!PRIVILEGED_ROLES.includes(operator.user.role)) {
      await tx.user.update({
        where: { id: operator.userId },
        data: { role: 'tourist' },
      })
    }

    return { userId: operator.userId, deletedActivities: deleted.count }
  })
}

/**
 * Désactive ou réactive un opérateur.
 *
 * C'est la sortie de scène de tout prestataire qui a déjà vendu : ses activités
 * passent en `archived` — donc hors du catalogue public et hors des recherches
 * — son compte retombe en `tourist`, et les réservations déjà prises restent
 * intactes et consultables par leurs titulaires comme par le back-office.
 *
 * La réactivation rend le rôle et rouvre la fiche, mais NE DÉSARCHIVE PAS les
 * activités. Republier en masse ressusciterait des départs passés et des prix
 * périmés : c'est à l'admin de rouvrir chaque fiche en connaissance de cause,
 * depuis /admin/activities.
 */
export async function setOperatorActive(input: {
  operatorId: string
  active: boolean
}): Promise<{ operatorId: string; active: boolean; archivedActivities: number }> {
  return db.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true, userId: true, user: { select: { role: true } } },
    })

    if (!operator) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Opérateur introuvable.' })
    }

    await tx.operator.update({
      where: { id: operator.id },
      data: { active: input.active },
    })

    let archivedActivities = 0

    if (!input.active) {
      // `archived` est déjà l'état terminal du catalogue : les activités
      // archivées sortent du public sans que rien ne soit détruit, et le jeu de
      // transitions existant sait les rouvrir une par une.
      const archived = await tx.activity.updateMany({
        where: { operatorId: operator.id, status: { not: 'archived' } },
        data: { status: 'archived' },
      })
      archivedActivities = archived.count
    }

    // Un admin ou un super admin à qui on aurait créé un profil opérateur ne
    // doit pas perdre ses droits par ce chemin — ni les retrouver par l'autre.
    if (!PRIVILEGED_ROLES.includes(operator.user.role)) {
      await tx.user.update({
        where: { id: operator.userId },
        data: { role: input.active ? 'operator' : 'tourist' },
      })
    }

    return { operatorId: operator.id, active: input.active, archivedActivities }
  })
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
      include: { operator: { select: { id: true, active: true } } },
    })

    if (existing?.operator) {
      throw new TRPCError({
        code: 'CONFLICT',
        // Un opérateur désactivé reste un opérateur : sans cette précision,
        // l'admin qui ne le retrouve pas dans le sélecteur de fiches en
        // recréerait un second sur la même adresse — ce que l'unicité refuse,
        // avec un message qui n'explique rien.
        message: existing.operator.active
          ? 'Ce compte est déjà opérateur.'
          : 'Ce compte est un opérateur désactivé : réactivez-le plutôt que d’en créer un second.',
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
    // `PRIVILEGED_ROLES` est le seul rempart, la promotion se fait sinon en
    // silence. Un super admin à qui on crée un profil opérateur se retrouverait
    // sans son accès aux interrupteurs, sans qu'aucun écran ne le signale.
    if (
      existing &&
      !PRIVILEGED_ROLES.includes(existing.role) &&
      existing.role !== 'operator'
    ) {
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

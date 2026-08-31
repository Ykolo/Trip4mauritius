import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { computeBookingAmounts } from '@/lib/pricing'
import type { BookingLineInput } from '@/lib/schemas/booking'
import { bookingInclude, toBooking } from '@/server/mappers/booking'
import type { Booking, CreateBookingResult } from '@/types/cart'

// Création et annulation de réservations.
//
// C'est le seul endroit du projet où la CORRECTION du système est en jeu :
// deux touristes peuvent viser la dernière place à la même milliseconde. Tout
// ce qui suit est écrit pour ce cas-là, pas pour le cas nominal.

/**
 * Nombre maximum de réservations actives qu'un compte peut détenir sur un même
 * créneau : une seule.
 *
 * Tant que Stripe n'est pas branché, RIEN ne coûte à celui qui réserve —
 * l'acompte de 20 % n'est pas qu'un modèle économique, c'est le mécanisme
 * anti-abus. Sans lui, un compte peut verrouiller tout l'inventaire
 * gratuitement. Cette limite bloque au moins l'empilement trivial sur un
 * départ donné, et se retire proprement le jour où le paiement arrive.
 */
const ACTIVE_STATUSES = ['pending_payment', 'confirmed'] as const

/**
 * Référence lisible, tirée d'une SÉQUENCE Postgres.
 *
 * Surtout pas d'un `count() + 1` : deux transactions concurrentes liraient le
 * même compteur et produiraient deux fois la même référence, que la contrainte
 * d'unicité rejetterait — un échec de réservation parfaitement évitable. Une
 * séquence n'est jamais servie deux fois, même en cas de rollback.
 */
async function nextBookingRef(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ ref: string }[]>`
    SELECT nextval('booking_ref_seq')::text AS ref
  `
  const serial = rows[0]?.ref ?? '0'
  return `MX-${new Date().getFullYear()}-${serial.padStart(6, '0')}`
}

export async function createBookings(input: {
  userId: string
  lines: BookingLineInput[]
  contactPhone: string
}): Promise<CreateBookingResult> {
  // Un créneau ne peut pas figurer deux fois dans le même panier : ce serait
  // deux réservations que la limite anti-abus rejetterait de toute façon, mais
  // autant le dire clairement plutôt que d'échouer au milieu du tunnel.
  const slotIds = new Set<string>()
  for (const line of input.lines) {
    if (slotIds.has(line.slotId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Un même créneau apparaît deux fois dans le panier.',
      })
    }
    slotIds.add(line.slotId)
  }

  // Traiter les créneaux dans un ORDRE STABLE.
  //
  // Chaque UPDATE verrouille la ligne de son créneau jusqu'au commit. Deux
  // paniers contenant les créneaux A et B dans des ordres opposés
  // s'interbloqueraient : le premier tient A et attend B, le second tient B et
  // attend A. Postgres tuerait l'un des deux au bout d'une seconde. Trier par
  // id impose le même ordre de verrouillage à tout le monde — le deadlock
  // devient impossible, pas simplement rare.
  const lines = [...input.lines].sort((a, b) => a.slotId.localeCompare(b.slotId))

  const created = await db.$transaction(
    async (tx) => {
      const bookings = []

      for (const line of lines) {
        const slot = await tx.activitySlot.findUnique({
          where: { id: line.slotId },
          include: { activity: true },
        })

        if (!slot || slot.activity.status !== 'published') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: "Ce créneau n'est plus proposé.",
          })
        }

        if (slot.startsAt.getTime() <= Date.now()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ce départ est déjà passé.',
          })
        }

        if (line.participants > slot.activity.maxParticipants) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cette activité accepte au maximum ${slot.activity.maxParticipants} participants.`,
          })
        }

        // ── Le point critique ────────────────────────────────────────────
        // UPDATE conditionnel atomique : la condition de capacité est évaluée
        // par Postgres AU MOMENT de l'écriture, sur la ligne qu'il verrouille.
        // Lire puis écrire en deux temps laisserait une fenêtre entre les deux
        // — c'est exactement là que naît la survente.
        //
        // Pas de SELECT ... FOR UPDATE : le verrou de ligne est implicite, il
        // n'y a qu'un aller-retour, et rien à oublier de déverrouiller.
        const updated = await tx.$executeRaw`
          UPDATE activity_slots
             SET "spotsTaken" = "spotsTaken" + ${line.participants}
           WHERE id = ${line.slotId}
             AND "spotsTaken" + ${line.participants} <= "maxSpots"
        `

        if (updated === 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Plus assez de places disponibles pour « ${slot.activity.title} ».`,
          })
        }

        // Contrôle anti-abus placé APRÈS l'UPDATE, et ce n'est pas un détail :
        // c'est l'UPDATE qui a pris le verrou sur le créneau. Une seconde
        // transaction visant le même créneau a donc attendu ce commit, et son
        // SELECT — nouvelle requête, nouvel instantané en READ COMMITTED — voit
        // la réservation que la première vient d'écrire. Avant l'UPDATE, les
        // deux liraient « aucune réservation » et passeraient toutes les deux.
        const alreadyBooked = await tx.booking.findFirst({
          where: {
            userId: input.userId,
            slotId: line.slotId,
            status: { in: [...ACTIVE_STATUSES] },
          },
          select: { id: true },
        })

        if (alreadyBooked) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Vous avez déjà une réservation sur ce départ de « ${slot.activity.title} ».`,
          })
        }

        // Prix relu EN BASE, jamais reçu du client : le panier vit dans le
        // navigateur, tout montant qui en viendrait serait modifiable.
        const amounts = computeBookingAmounts(
          slot.activity.priceHt.toNumber(),
          line.participants,
        )

        const booking = await tx.booking.create({
          data: {
            bookingRef: await nextBookingRef(tx),
            userId: input.userId,
            slotId: line.slotId,
            participants: line.participants,
            contactPhone: input.contactPhone,
            ...amounts,
            // Sans Stripe, une réservation est confirmée d'emblée. Le jour où
            // le paiement arrive, c'est cette valeur qui passe à
            // `pending_payment` — la machine à états, elle, existe déjà.
            status: 'confirmed',
          },
          include: bookingInclude,
        })

        bookings.push(booking)
      }

      // Le compte n'a pas encore de numéro : on adopte celui qu'il vient de
      // saisir comme valeur par défaut de ses prochains formulaires. On
      // n'ÉCRASE jamais un numéro existant — le profil reste modifiable
      // depuis /account, et une réservation ne doit pas le redéfinir dans son
      // dos.
      await tx.user.updateMany({
        where: { id: input.userId, phone: null },
        data: { phone: input.contactPhone },
      })

      return bookings
    },
    // Plusieurs allers-retours vers Neon par ligne de panier : les 5 secondes
    // par défaut sont trop justes pour un panier de plusieurs activités.
    { timeout: 20_000 },
  )

  const bookings: Booking[] = created.map(toBooking)

  return {
    bookings,
    bookingRef: bookings[0]?.bookingRef ?? '',
    totalDeposit: bookings.reduce((sum, b) => sum + b.depositDue, 0),
  }
}

export async function cancelBooking(input: {
  userId: string
  bookingId: string
}): Promise<Booking> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      // Le filtre par userId est dans le WHERE, pas dans un test après coup :
      // deviner un id ne doit pas suffire à annuler la réservation d'autrui.
      where: { id: input.bookingId, userId: input.userId },
      include: bookingInclude,
    })

    if (!booking) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    if (booking.slot.startsAt.getTime() <= Date.now()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ce départ est passé, la réservation ne peut plus être annulée.',
      })
    }

    // Transition de statut conditionnée sur le statut LU : c'est le même
    // schéma que l'UPDATE de capacité. Deux annulations concurrentes (un
    // double-clic suffit) décrémenteraient sinon les places deux fois pour une
    // seule réservation, et le créneau paraîtrait plus vide qu'il ne l'est.
    const transitioned = await tx.booking.updateMany({
      where: { id: booking.id, status: { in: [...ACTIVE_STATUSES] } },
      data: { status: 'cancelled' },
    })

    if (transitioned.count === 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: "Cette réservation n'est plus annulable.",
      })
    }

    // Libération des places DANS LA MÊME TRANSACTION que le passage à
    // `cancelled`. Séparées, un incident entre les deux laisserait des places
    // réservées par une réservation annulée : l'inventaire fuirait
    // définitivement, les créneaux se rempliraient d'annulations et ne se
    // revendraient jamais.
    //
    // Soustraction franche, sans GREATEST(0, …) : la garde de statut ci-dessus
    // rend le double décrément impossible, et le CHECK `spotsTaken >= 0` doit
    // rester capable de signaler une régression au lieu de l'absorber.
    await tx.$executeRaw`
      UPDATE activity_slots
         SET "spotsTaken" = "spotsTaken" - ${booking.participants}
       WHERE id = ${booking.slotId}
    `

    return toBooking({ ...booking, status: 'cancelled' })
  })
}

export async function listMyBookings(userId: string): Promise<Booking[]> {
  const rows = await db.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(toBooking)
}

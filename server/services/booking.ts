import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ACTIVE_BOOKING_STATUSES } from '@/lib/booking-status'
import { fromMauritiusWallClock } from '@/lib/datetime'
import { billedDays, computeBookingAmounts } from '@/lib/pricing'
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
const ACTIVE_STATUSES = ACTIVE_BOOKING_STATUSES

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

/**
 * Une date + une heure murales mauriciennes → l'instant correspondant.
 *
 * Le parsing vit ici plutôt que dans Zod parce que Zod valide la FORME et la
 * conversion est une décision de fuseau, qui appartient au serveur.
 */
function wallClockToInstant(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return fromMauritiusWallClock(year, month, day, hour, minute)
}

/** Deux périodes se chevauchent si chacune commence avant que l'autre finisse. */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart
}

/**
 * Clé de VERROUILLAGE d'une ligne de panier — c'est elle qui rend
 * l'interblocage impossible.
 *
 * Chaque ligne verrouille une ligne de base jusqu'au commit : le créneau pour
 * une réservation à départ fixe, l'activité pour une location à la journée.
 * Deux paniers qui prendraient ces verrous dans des ordres opposés
 * s'attendraient mutuellement, et Postgres en tuerait un.
 *
 * Le tri par `slotId` suffisait quand il n'y avait qu'une sorte de verrou. Avec
 * deux tables cibles, il faut un ordre TOTAL commun à toutes les transactions —
 * d'où cette clé préfixée. Triée, elle place tous les verrous « journée » avant
 * tous les verrous « créneau », chacun ordonné par identifiant. L'ordre
 * d'acquisition devient identique partout, et le deadlock impossible plutôt que
 * rare.
 */
function lockKey(line: BookingLineInput): string {
  return line.mode === 'daily'
    ? `daily:${line.activityId}`
    : `slot:${line.slotId}`
}

/**
 * Une location à la journée.
 *
 * Il n'y a ici AUCUN compteur à incrémenter : le stock n'est pas une colonne
 * qu'on décrémente mais une capacité qu'on compare au nombre de réservations
 * qui se chevauchent. Une Jeep louée du 12 au 14 n'est indisponible que sur ces
 * dates-là — un `spotsTaken` ne saurait pas exprimer ça.
 *
 * Le verrou est donc EXPLICITE, et c'est la première chose faite : `SELECT …
 * FOR UPDATE` sur la ligne de l'activité sérialise toutes les demandes qui la
 * visent. Sans lui, deux touristes comptant simultanément « 0 réservation sur
 * ces dates » repartiraient tous les deux avec la même voiture — c'est la
 * survente que la règle du projet interdit, sous une autre forme que celle des
 * créneaux.
 *
 * Tout ce qui suit le verrou est donc lu SOUS le verrou, `dailyUnits` compris :
 * lire la capacité avant l'aurait exposée à une modification concurrente.
 */
async function createDailyBooking(
  tx: Prisma.TransactionClient,
  userId: string,
  contactPhone: string,
  line: Extract<BookingLineInput, { mode: 'daily' }>,
) {
  const startsAt = wallClockToInstant(line.startDate, line.startTime)
  const endsAt = wallClockToInstant(line.endDate, line.endTime)

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'La date de fin doit être postérieure à la date de début.',
    })
  }

  if (startsAt.getTime() <= Date.now()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cette période a déjà commencé.',
    })
  }

  // ── Le point critique ──────────────────────────────────────────────────
  // Le verrou d'abord, la lecture ensuite. La requête sert aussi de contrôle
  // d'existence : une activité inconnue ne rend aucune ligne, donc aucun
  // verrou, et on s'arrête là.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM activities WHERE id = ${line.activityId} FOR UPDATE
  `

  if (locked.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: "Cette activité n'est plus proposée.",
    })
  }

  const activity = await tx.activity.findUniqueOrThrow({
    where: { id: line.activityId },
  })

  if (activity.status !== 'published') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: "Cette activité n'est plus proposée.",
    })
  }

  if (activity.bookingMode !== 'daily') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cette activité se réserve par créneau, pas à la journée.',
    })
  }

  // `dailyUnits` est garanti non nul par `activities_daily_requires_units` dès
  // que le mode est `daily`. Le test est là pour TypeScript, et pour que la
  // journée où la contrainte sauterait on refuse au lieu de survendre.
  if (activity.dailyUnits === null) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `L'activité « ${activity.title} » n'a pas de stock défini.`,
    })
  }

  if (line.participants > activity.maxParticipants) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cette activité accepte au maximum ${activity.maxParticipants} participants.`,
    })
  }

  // Le chevauchement, pas l'égalité : une location du 12 au 14 bloque le 13,
  // même si personne n'a demandé le 13 en tant que tel.
  const overlapping = {
    activityId: activity.id,
    status: { in: [...ACTIVE_STATUSES] },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
  } satisfies Prisma.BookingWhereInput

  const taken = await tx.booking.count({ where: overlapping })

  if (taken >= activity.dailyUnits) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `« ${activity.title} » n'est plus disponible sur cette période.`,
    })
  }

  // Même garde-fou anti-abus que sur les créneaux, transposé : tant que rien
  // n'est payé, un compte pourrait bloquer un véhicule en enchaînant les
  // demandes. Posé APRÈS le verrou, pour la même raison qu'il est posé après
  // l'UPDATE côté créneaux — avant, deux transactions concurrentes liraient
  // toutes les deux « aucune réservation ».
  const alreadyBooked = await tx.booking.findFirst({
    where: { ...overlapping, userId },
    select: { id: true },
  })

  if (alreadyBooked) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Vous avez déjà une réservation de « ${activity.title} » sur cette période.`,
    })
  }

  const days = billedDays(startsAt, endsAt)

  // Le prix du JOUR multiplié par le nombre de jours — jamais par le nombre de
  // participants. Louer une Jeep à quatre coûte le prix de la Jeep :
  // `maxParticipants` en est le nombre de places, pas un multiplicateur.
  const amounts = computeBookingAmounts(activity.priceHt.toNumber(), days)

  return tx.booking.create({
    data: {
      bookingRef: await nextBookingRef(tx),
      userId,
      activityId: activity.id,
      // Pas de créneau : c'est ce qui distingue les deux formes en base, et
      // `bookings_mode_shape` refuse toute ligne bâtarde.
      slotId: null,
      startsAt,
      endsAt,
      billedDays: days,
      participants: line.participants,
      contactPhone,
      ...amounts,
      // « Créée », comme sur les créneaux : la mise en relation avec le loueur
      // est manuelle, personne ne lui a encore dit qu'un client arrive.
      status: 'pending_validation',
    },
    include: bookingInclude,
  })
}

export async function createBookings(input: {
  userId: string
  lines: BookingLineInput[]
  contactPhone: string
}): Promise<CreateBookingResult> {
  // Un même départ ne peut pas figurer deux fois dans le panier : ce serait
  // deux réservations que la limite anti-abus rejetterait de toute façon, mais
  // autant le dire clairement plutôt que d'échouer au milieu du tunnel.
  //
  // En mode journée, le doublon n'est pas l'identité mais le CHEVAUCHEMENT :
  // louer la même voiture deux semaines distinctes est légitime, la louer deux
  // fois sur des dates qui se recouvrent ne l'est pas.
  const seenSlots = new Set<string>()
  const seenPeriods: { activityId: string; start: Date; end: Date }[] = []

  for (const line of input.lines) {
    if (line.mode === 'slot') {
      if (seenSlots.has(line.slotId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Un même créneau apparaît deux fois dans le panier.',
        })
      }
      seenSlots.add(line.slotId)
      continue
    }

    const start = wallClockToInstant(line.startDate, line.startTime)
    const end = wallClockToInstant(line.endDate, line.endTime)

    const clash = seenPeriods.some(
      (p) => p.activityId === line.activityId && overlaps(p.start, p.end, start, end),
    )

    if (clash) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Deux locations de la même activité se chevauchent dans le panier.',
      })
    }

    seenPeriods.push({ activityId: line.activityId, start, end })
  }

  // Traiter les lignes dans un ORDRE STABLE, cf. `lockKey` ci-dessus : c'est ce
  // qui rend l'interblocage impossible plutôt que rare.
  const lines = [...input.lines].sort((a, b) =>
    lockKey(a).localeCompare(lockKey(b)),
  )

  const created = await db.$transaction(
    async (tx) => {
      const bookings = []

      for (const line of lines) {
        if (line.mode === 'daily') {
          bookings.push(
            await createDailyBooking(tx, input.userId, input.contactPhone, line),
          )
          continue
        }

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
            activityId: slot.activityId,
            slotId: line.slotId,
            // Recopié du créneau, jamais pointé : la réservation fige la
            // période qu'elle engage. Voir `Booking.startsAt` au schéma.
            startsAt: slot.startsAt,
            participants: line.participants,
            contactPhone: input.contactPhone,
            ...amounts,
            // « Créée », pas « Validée ».
            //
            // La mise en relation avec l'opérateur est MANUELLE : au moment où
            // le touriste réserve, personne n'a encore prévenu le prestataire
            // qu'un groupe arrive. Naître `confirmed` promettait donc au client
            // une confirmation que rien n'avait produite. C'est l'admin qui
            // fait passer la réservation à `confirmed`, depuis
            // /admin/bookings, une fois l'opérateur joint et d'accord.
            //
            // La place, elle, est bien retenue dès maintenant — c'est l'UPDATE
            // conditionnel ci-dessus qui l'a décomptée, pas ce statut.
            status: 'pending_validation',
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

    // `booking.startsAt` et non `booking.slot.startsAt` : une location à la
    // journée n'a pas de créneau, et la réservation porte de toute façon la
    // période qu'elle engage.
    if (booking.startsAt.getTime() <= Date.now()) {
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
    //
    // UNIQUEMENT en mode créneau. Une location à la journée n'a pas de compteur
    // à recréditer : sa période redevient libre du seul fait que le statut
    // n'est plus actif, puisque la disponibilité se calcule en comptant les
    // réservations actives qui chevauchent.
    if (booking.slotId !== null) {
      await tx.$executeRaw`
        UPDATE activity_slots
           SET "spotsTaken" = "spotsTaken" - ${booking.participants}
         WHERE id = ${booking.slotId}
      `
    }

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

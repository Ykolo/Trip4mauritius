import type {
  Activity as DbActivity,
  ActivitySlot as DbSlot,
  Booking as DbBooking,
  Operator as DbOperator,
} from '@prisma/client'
import { ACTIVE_BOOKING_STATUSES } from '@/lib/booking-status'
import { mauritiusDate, mauritiusTime } from '@/lib/datetime'
import type { Booking, BookingStatus } from '@/types/cart'

// Point de conversion UNIQUE entre le modèle base et le contrat du front, au
// même titre que server/mappers/activity.ts : Decimal → number, Date → chaînes
// mauriciennes, et dérivation de `cancellable`.

// L'activité vient désormais de la réservation elle-même, pas du créneau : une
// location à la journée n'en a pas. Le créneau reste dans le contexte — il
// porte la capacité, dont l'espace opérateur a besoin — mais il est OPTIONNEL,
// et le type l'impose : plus rien ne peut le déréférencer sans le tester.
export type BookingWithContext = DbBooking & {
  activity: DbActivity & { operator: DbOperator }
  slot: DbSlot | null
}

/**
 * Une réservation est annulable si elle est encore active ET si elle n'a pas
 * commencé. Cette règle est dérivée ICI, une seule fois : dupliquée dans le
 * composant qui dessine le bouton, elle finirait par diverger de celle que
 * `cancelBooking` applique réellement — et l'utilisateur verrait un bouton qui
 * échoue.
 *
 * Elle lit `booking.startsAt`, que les DEUX modes renseignent, et non plus le
 * créneau : c'est précisément ce que cette colonne rend possible.
 */
export function isCancellable(booking: DbBooking): boolean {
  // `ACTIVE_BOOKING_STATUSES` et non une liste écrite ici : une réservation
  // « Créée » retient déjà une place, elle doit donc rester annulable. La
  // recopier localement avait toutes les chances d'oublier le nouvel état au
  // moment de l'ajouter — et le touriste se serait retrouvé sans bouton.
  const active = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(
    booking.status,
  )
  return active && booking.startsAt.getTime() > Date.now()
}

export function toBooking(booking: BookingWithContext): Booking {
  const { activity } = booking

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    activityTitle: activity.title,
    activitySlug: activity.slug,
    imageUrl: activity.imageUrls[0] ?? '',
    operatorName: activity.operator.displayName,
    // Le mode voyage jusqu'au front : c'est lui qui décide si l'écran affiche
    // un départ ou une période. Le recalculer là-bas à partir de la présence
    // d'`endDate` marcherait, et se tromperait au premier champ ajouté.
    mode: booking.slotId === null ? 'daily' : 'slot',
    date: mauritiusDate(booking.startsAt),
    time: mauritiusTime(booking.startsAt),
    // `null` en mode créneau — la fin y appartient à l'activité, pas à la
    // réservation.
    endDate: booking.endsAt ? mauritiusDate(booking.endsAt) : null,
    endTime: booking.endsAt ? mauritiusTime(booking.endsAt) : null,
    billedDays: booking.billedDays,
    participants: booking.participants,
    totalPrice: booking.totalPrice.toNumber(),
    depositDue: booking.depositDue.toNumber(),
    balanceDueOnSite: booking.balanceDueOnSite.toNumber(),
    status: booking.status as BookingStatus,
    contactPhone: booking.contactPhone,
    cancellable: isCancellable(booking),
    createdAt: booking.createdAt.toISOString(),
  }
}

/** `include` partagé : garantit que toBooking reçoit toujours son contexte. */
export const bookingInclude = {
  activity: { include: { operator: true } },
  slot: true,
} as const

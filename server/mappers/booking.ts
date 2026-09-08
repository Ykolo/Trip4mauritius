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

export type BookingWithContext = DbBooking & {
  slot: DbSlot & { activity: DbActivity & { operator: DbOperator } }
}

/**
 * Une réservation est annulable si elle est encore active ET si le départ n'a
 * pas eu lieu. Cette règle est dérivée ICI, une seule fois : dupliquée dans le
 * composant qui dessine le bouton, elle finirait par diverger de celle que
 * `cancelBooking` applique réellement — et l'utilisateur verrait un bouton qui
 * échoue.
 */
export function isCancellable(booking: DbBooking, slot: DbSlot): boolean {
  // `ACTIVE_BOOKING_STATUSES` et non une liste écrite ici : une réservation
  // « Créée » retient déjà une place, elle doit donc rester annulable. La
  // recopier localement avait toutes les chances d'oublier le nouvel état au
  // moment de l'ajouter — et le touriste se serait retrouvé sans bouton.
  const active = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(
    booking.status,
  )
  return active && slot.startsAt.getTime() > Date.now()
}

export function toBooking(booking: BookingWithContext): Booking {
  const { slot } = booking
  const { activity } = slot

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    activityTitle: activity.title,
    activitySlug: activity.slug,
    imageUrl: activity.imageUrls[0] ?? '',
    operatorName: activity.operator.displayName,
    date: mauritiusDate(slot.startsAt),
    time: mauritiusTime(slot.startsAt),
    participants: booking.participants,
    totalPrice: booking.totalPrice.toNumber(),
    depositDue: booking.depositDue.toNumber(),
    balanceDueOnSite: booking.balanceDueOnSite.toNumber(),
    status: booking.status as BookingStatus,
    contactPhone: booking.contactPhone,
    cancellable: isCancellable(booking, slot),
    createdAt: booking.createdAt.toISOString(),
  }
}

/** `include` partagé : garantit que toBooking reçoit toujours son contexte. */
export const bookingInclude = {
  slot: { include: { activity: { include: { operator: true } } } },
} as const

import type {
  Activity as DbActivity,
  ActivitySlot as DbSlot,
  Booking as DbBooking,
  Operator as DbOperator,
  User as DbUser,
} from '@prisma/client'
import { mauritiusDate, mauritiusTime } from '@/lib/datetime'
import {
  toDescription,
  type DbActivityWithCategory,
} from '@/server/mappers/activity'
import type { ActivityStatus } from '@/types/activity'
import type { BookingStatus } from '@/types/cart'
import type {
  OperatorActivityDetail,
  OperatorActivitySummary,
  OperatorBookingRow,
  OperatorProfile,
  OperatorSlot,
} from '@/types/operator'

// Conversion base → contrat opérateur. Même rôle que les autres mappers : la
// traduction `spotsTaken` → `spotsLeft` et le formatage mauricien n'existent
// qu'ici.

export function toOperatorProfile(operator: DbOperator): OperatorProfile {
  return {
    id: operator.id,
    displayName: operator.displayName,
    avatarUrl: operator.avatarUrl,
    verified: operator.verified,
    payoutEnabled: operator.payoutEnabled,
  }
}

export function toOperatorSlot(
  slot: DbSlot & { _count?: { bookings: number } },
): OperatorSlot {
  return {
    id: slot.id,
    date: mauritiusDate(slot.startsAt),
    time: mauritiusTime(slot.startsAt),
    maxSpots: slot.maxSpots,
    spotsTaken: slot.spotsTaken,
    spotsLeft: slot.maxSpots - slot.spotsTaken,
    // `slots → bookings` est en RESTRICT : supprimer un créneau réservé
    // échouerait sur une contrainte de clé étrangère illisible. On le dit avant
    // plutôt que de laisser l'opérateur buter dessus.
    deletable: (slot._count?.bookings ?? 0) === 0,
  }
}

export function toOperatorActivitySummary(
  activity: DbActivityWithCategory & {
    _count?: { slots: number }
    bookingsCount?: number
  },
): OperatorActivitySummary {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    category: activity.category.label,
    categoryId: activity.categoryId,
    region: activity.region,
    imageUrl: activity.imageUrls[0] ?? '',
    priceHT: activity.priceHt.toNumber(),
    status: activity.status as ActivityStatus,
    bookingMode: activity.bookingMode,
    slotCount: activity._count?.slots ?? 0,
    bookingsCount: activity.bookingsCount ?? 0,
  }
}

export function toOperatorActivityDetail(
  activity: DbActivityWithCategory & {
    slots: (DbSlot & { _count?: { bookings: number } })[]
    _count?: { slots: number }
  },
): OperatorActivityDetail {
  return {
    ...toOperatorActivitySummary(activity),
    slotCount: activity.slots.length,
    duration: activity.duration,
    durationMinutes: activity.durationMinutes,
    dailyUnits: activity.dailyUnits,
    maxParticipants: activity.maxParticipants,
    languages: activity.languages,
    imageUrls: activity.imageUrls,
    included: activity.included,
    excluded: activity.excluded,
    // Même repli que côté public : le contrat promet 5 clés, la base n'en
    // stocke que ce qui a été saisi.
    description: toDescription(activity.description),
    slots: activity.slots.map(toOperatorSlot),
  }
}

// L'activité vient de la réservation, plus du créneau : une location à la
// journée n'en a pas.
export type OperatorBookingRow_ = DbBooking & {
  user: DbUser
  activity: DbActivity
}

export function toOperatorBookingRow(
  booking: OperatorBookingRow_,
): OperatorBookingRow {
  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    // La période est portée par la réservation elle-même — c'est ce qui permet
    // à cette ligne de décrire indifféremment un départ et une location.
    date: mauritiusDate(booking.startsAt),
    time: mauritiusTime(booking.startsAt),
    endDate: booking.endsAt ? mauritiusDate(booking.endsAt) : null,
    endTime: booking.endsAt ? mauritiusTime(booking.endsAt) : null,
    touristName: booking.user.name,
    // Le numéro FIGÉ sur la réservation, jamais `user.phone` : le client a pu
    // changer son profil depuis, l'opérateur doit voir ce qui a été donné pour
    // CE départ.
    contactPhone: booking.contactPhone,
    activityTitle: booking.activity.title,
    participants: booking.participants,
    totalPrice: booking.totalPrice.toNumber(),
    depositDue: booking.depositDue.toNumber(),
    balanceDueOnSite: booking.balanceDueOnSite.toNumber(),
    status: booking.status as BookingStatus,
  }
}

import type { ActivityStatus } from '@/types/activity'
import type { BookingStatus } from '@/types/cart'

// Contrat de sortie de l'espace opérateur.
//
// Distinct de `types/activity.ts` à dessein : l'opérateur voit ses brouillons,
// ses activités rejetées et le nom de ses clients — rien de tout cela n'a sa
// place dans le contrat public.

export interface OperatorProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  verified: boolean
  payoutEnabled: boolean
}

export interface OperatorStats {
  /** Réservations confirmées, tous créneaux confondus. */
  totalBookings: number
  /** Chiffre d'affaires des réservations confirmées, en euros. */
  totalRevenue: number
  /** Part encaissée par la plateforme (les acomptes de 20 %). */
  platformFee: number
  /** Places vendues / places offertes sur les départs à venir, en %. */
  occupancyRate: number
  upcomingDepartures: number
}

export interface OperatorSlot {
  id: string
  date: string
  time: string
  maxSpots: number
  spotsTaken: number
  spotsLeft: number
  /** Un créneau déjà réservé ne peut plus être supprimé (FK en RESTRICT). */
  deletable: boolean
}

export interface OperatorActivitySummary {
  id: string
  slug: string
  title: string
  category: string
  region: string
  imageUrl: string
  priceHT: number
  status: ActivityStatus
  slotCount: number
  bookingsCount: number
}

export interface OperatorActivityDetail extends OperatorActivitySummary {
  duration: string
  maxParticipants: number
  languages: string[]
  imageUrls: string[]
  included: string[]
  excluded: string[]
  description: Record<'fr' | 'en' | 'de' | 'es' | 'ru', string>
  slots: OperatorSlot[]
}

export interface OperatorBookingRow {
  id: string
  bookingRef: string
  date: string
  time: string
  touristName: string
  /** Le numéro figé sur la réservation, pas celui du profil du client. */
  contactPhone: string | null
  activityTitle: string
  participants: number
  totalPrice: number
  depositDue: number
  balanceDueOnSite: number
  status: BookingStatus
}

export interface OperatorBookingsPage {
  bookings: OperatorBookingRow[]
  total: number
  pages: number
}

export interface UpcomingDeparture {
  slotId: string
  activityTitle: string
  date: string
  time: string
  participants: number
  maxSpots: number
}

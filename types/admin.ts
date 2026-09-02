import type { ActivityStatus } from '@/types/activity'
import type { BookingStatus } from '@/types/cart'
import type { FeatureKey } from '@/lib/features'

// Contrat de sortie de l'espace d'administration.
//
// L'admin voit ce qu'aucun autre rôle ne voit : les brouillons de tous les
// opérateurs, l'identité derrière un nom commercial, et les demandes d'accès
// en attente. D'où un contrat séparé — ces champs ne doivent jamais fuiter
// dans une réponse publique par un `include` malheureux.

export interface ModerationActivity {
  id: string
  slug: string
  title: string
  category: string
  region: string
  imageUrl: string
  priceHT: number
  duration: string
  maxParticipants: number
  languages: string[]
  included: string[]
  excluded: string[]
  imageUrls: string[]
  description: Record<'fr' | 'en' | 'de' | 'es' | 'ru', string>
  status: ActivityStatus
  operatorName: string
  operatorId: string
  operatorVerified: boolean
  upcomingSlots: number
  submittedAt: string
}

export interface OperatorRequest {
  operatorId: string
  userId: string
  displayName: string
  /** Identité réelle derrière le nom commercial — réservé à l'admin. */
  userName: string
  userEmail: string
  verified: boolean
  role: string
  activityCount: number
  requestedAt: string
}

/** Couche de la cascade qui a eu le dernier mot. Voir server/services/features.ts. */
export type FeatureSource = 'default' | 'env' | 'database'

export interface FeatureFlagRow {
  /** Typée sur le registre : l'écran d'administration ne peut pas basculer une
   *  clé qui n'existe pas, et le compilateur le vérifie. */
  key: FeatureKey
  label: string
  description: string
  /** Valeur effectivement appliquée, après résolution de la cascade. */
  enabled: boolean
  defaultValue: boolean
  source: FeatureSource
  /** Nom de la variable d'environnement correspondante, affiché tel quel. */
  envVar: string
  updatedBy: string | null
  updatedAt: string | null
  expiresOn: string
  expired: boolean
}

/**
 * Une réservation vue par l'admin.
 *
 * Elle porte les DEUX contacts — celui du touriste et celui de l'opérateur —
 * parce que c'est précisément ce que le back-office doit permettre : mettre
 * les deux en relation à la main tant que rien ne le fait automatiquement.
 * Sans ça, l'admin doit ouvrir la base pour trouver un numéro de téléphone.
 */
export interface AdminBookingRow {
  id: string
  bookingRef: string
  status: BookingStatus
  createdAt: string

  /** Départ, épinglé sur Indian/Mauritius. */
  date: string
  time: string
  /** Le départ a-t-il déjà eu lieu ? Dérivé ici, jamais recalculé côté écran. */
  departed: boolean

  activityTitle: string
  activitySlug: string
  participants: number
  totalPrice: number
  depositDue: number
  balanceDueOnSite: number

  touristName: string
  touristEmail: string
  /** Le numéro figé sur la réservation, pas celui du profil du client. */
  contactPhone: string | null

  operatorId: string
  operatorName: string
  operatorEmail: string
}

export interface AdminBookingsPage {
  bookings: AdminBookingRow[]
  total: number
  pages: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  bookingsCount: number
  /** Nom commercial si le compte porte un profil opérateur, sinon null. */
  operatorName: string | null
  operatorVerified: boolean
}

export interface AdminUsersPage {
  users: AdminUserRow[]
  total: number
  pages: number
}

export interface AdminOverview {
  pendingActivities: number
  pendingOperators: number
  publishedActivities: number
  totalOperators: number
  totalBookings: number
}

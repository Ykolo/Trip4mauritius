import type { ActivityStatus } from '@/types/activity'

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

export interface AdminOverview {
  pendingActivities: number
  pendingOperators: number
  publishedActivities: number
  totalOperators: number
  totalBookings: number
}

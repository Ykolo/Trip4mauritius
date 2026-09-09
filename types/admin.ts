import type { ActivityStatus } from '@/types/activity'
import type { BookingStatus } from '@/types/cart'
import type { FeatureKey } from '@/lib/features'
import type {
  OperatorActivityDetail,
  OperatorActivitySummary,
} from '@/types/operator'

// Contrat de sortie de l'espace d'administration.
//
// L'admin voit ce qu'aucun autre rôle ne voit : les brouillons de tous les
// opérateurs et l'identité réelle derrière un nom commercial. D'où un contrat
// séparé — ces champs ne doivent jamais fuiter dans une réponse publique par un
// `include` malheureux.
//
// Lot 1 : ni file de modération, ni demandes d'accès en attente, ni listing de
// comptes. Trip4mauritius tient le catalogue et crée les opérateurs elle-même.

export interface AdminOperator {
  operatorId: string
  userId: string
  displayName: string
  /** Identité réelle derrière le nom commercial — réservé à l'admin. */
  userName: string
  userEmail: string
  /** Numéro professionnel du prestataire — le bouton WhatsApp du back-office. */
  whatsapp: string | null
  avatarUrl: string | null
  activityCount: number
  /**
   * Réservations portées par les activités de cet opérateur, tous statuts
   * confondus — annulations comprises. C'est ce qui décide si la fiche est
   * supprimable, et une annulation reste une trace comptable qu'on ne jette pas.
   */
  bookingCount: number
  /**
   * Dérivé côté serveur, jamais recalculé dans l'écran — même doctrine que
   * `Booking.cancellable` et `OperatorSlot.deletable`. Le front qui
   * reconstituerait la règle finirait par proposer un bouton que la procédure
   * rejette.
   */
  deletable: boolean
  /** `false` : activités archivées et compte rétrogradé. Voir `Operator.active`. */
  active: boolean
  createdAt: string
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

  /** Créneau ou location à la journée — décide de ce que la ligne affiche. */
  mode: 'slot' | 'daily'
  /** Début, épinglé sur Indian/Mauritius. Renseigné dans les deux modes. */
  date: string
  time: string
  /** Fin de la location — `null` en mode créneau. */
  endDate: string | null
  endTime: string | null
  /** Jours facturés en mode journée, `null` en mode créneau. */
  billedDays: number | null
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
  /**
   * Numéro professionnel de l'opérateur, tel que saisi — pas encore normalisé.
   * La fabrication du lien `wa.me` vit dans `lib/whatsapp.ts`, un seul endroit.
   * `null` tant qu'aucun numéro n'a été renseigné : le bouton se désactive.
   */
  operatorWhatsapp: string | null
}

export interface AdminBookingsPage {
  bookings: AdminBookingRow[]
  total: number
  pages: number
}

// Catalogue vu par l'admin.
//
// On ÉTEND le contrat opérateur au lieu de le recopier : c'est la même entité,
// éditée par le même formulaire. Deux interfaces jumelles auraient divergé au
// premier champ ajouté, et l'écran d'administration aurait cessé d'afficher ce
// que l'opérateur saisit. Les deux seuls champs propres à l'admin sont ceux
// qu'un opérateur n'a aucune raison de voir : à QUI appartient la fiche.

export interface AdminActivityRow extends OperatorActivitySummary {
  operatorId: string
  operatorName: string
  /** Départs à venir — une fiche à zéro ne peut pas être mise en ligne. */
  upcomingSlots: number
  updatedAt: string
}

export interface AdminActivitiesPage {
  activities: AdminActivityRow[]
  total: number
  pages: number
}

export interface AdminActivityDetail extends OperatorActivityDetail {
  operatorId: string
  operatorName: string
}

/** Une entrée du sélecteur d'opérateur, à la création d'une fiche. */
export interface AdminOperatorOption {
  id: string
  displayName: string
  verified: boolean
  activityCount: number
}

export interface AdminOverview {
  publishedActivities: number
  pendingBookings: number
  confirmedBookings: number
  totalOperators: number
  publishedGuides: number
}

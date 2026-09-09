// Contrat de sortie du panier et des réservations.
//
// Le panier vit côté client (Zustand + localStorage, cf. lib/stores/cart.ts) :
// il n'a aucune existence en base. Les champs d'affichage ci-dessous sont un
// INSTANTANÉ pris au moment de l'ajout — utile pour peindre la page sans
// requête, mais jamais une source de vérité. Le serveur relit le prix depuis
// `Activity.priceHt` et recalcule tout à la création de la réservation.

export interface CartItemSlot {
  date: string
  time: string
}

export interface CartItemActivity {
  slug: string
  title: string
  imageUrl: string
  operator: string
}

export interface CartItem {
  /** Clé du panier : un créneau ne peut y figurer qu'une seule fois. */
  slotId: string
  activityId: string
  activity: CartItemActivity
  slot: CartItemSlot
  participants: number
  /** Prix par personne relevé à l'ajout — indicatif, revérifié côté serveur. */
  pricePerPerson: number
}

export interface CartTotals {
  items: CartItem[]
  itemCount: number
  totalPrice: number
  totalDeposit: number
  totalOnSite: number
}

/**
 * Les 6 états de `BookingStatus` en base, tels quels.
 *
 * Libellés, couleurs et transitions autorisées vivent dans
 * `lib/booking-status.ts` — pas ici, et surtout pas recopiés dans les écrans.
 */
export type BookingStatus =
  | 'pending_validation'
  | 'pending_payment'
  | 'confirmed'
  | 'expired'
  | 'cancelled'
  | 'completed'

export interface Booking {
  id: string
  bookingRef: string
  activityTitle: string
  activitySlug: string
  imageUrl: string
  operatorName: string
  /**
   * Comment cette réservation a été vendue. Dérivé côté serveur : l'écran
   * n'a pas à deviner qu'une réservation est une location parce qu'elle porte
   * une date de fin.
   */
  mode: 'slot' | 'daily'
  /** Début, épinglé sur Indian/Mauritius. Renseigné dans les deux modes. */
  date: string
  time: string
  /**
   * Fin de la période — `null` en mode créneau, où la durée appartient à
   * l'activité et non à la réservation.
   */
  endDate: string | null
  endTime: string | null
  /** Jours facturés en mode journée, `null` en mode créneau. */
  billedDays: number | null
  participants: number
  totalPrice: number
  depositDue: number
  balanceDueOnSite: number
  status: BookingStatus
  contactPhone: string | null
  /**
   * Dérivé côté serveur : ni le statut ni la date seuls ne suffisent, et
   * laisser le front recombiner les deux ferait diverger le bouton de la règle
   * réellement appliquée par `booking.cancel`.
   */
  cancellable: boolean
  createdAt: string
}

/**
 * Un panier de N activités produit N réservations, donc N références.
 *
 * Ce contrat portait aussi un `bookingRef` au singulier — la référence de la
 * PREMIÈRE réservation — et l'écran de confirmation n'affichait que celui-là :
 * un panier à deux activités renvoyait le touriste avec un seul code sur deux,
 * alors que le back-office en montrait bien deux. Le champ est retiré plutôt
 * que corrigé : tant qu'il existe, il se relit comme « la » référence de la
 * commande, et le prochain écran refera l'erreur. Il n'y a pas de commande ici,
 * seulement des réservations, une par départ.
 */
export interface CreateBookingResult {
  bookings: Booking[]
  totalDeposit: number
}

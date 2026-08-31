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

/** Les 5 états de `BookingStatus` en base, tels quels. */
export type BookingStatus =
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
  /** Date et heure du départ, épinglées sur Indian/Mauritius. */
  date: string
  time: string
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

export interface CreateBookingResult {
  bookings: Booking[]
  /** Référence de la première réservation — celle affichée en confirmation. */
  bookingRef: string
  totalDeposit: number
}

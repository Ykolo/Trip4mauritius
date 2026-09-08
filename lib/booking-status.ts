import type { BookingStatus } from '@/types/cart'

// Vocabulaire des statuts de réservation — source UNIQUE.
//
// Trois écrans portaient chacun leur propre `Record<BookingStatus, string>` :
// `/admin/bookings`, `/operator/bookings` et `components/ui/BookingCard`. La
// même réservation s'y affichait « En attente », « En attente » et « En attente
// de paiement ». C'est exactement le motif qui avait cassé le catalogue quand
// les catégories vivaient en dur dans trois composants, et la raison d'être de
// `lib/regions.ts` et `lib/durations.ts`.
//
// Tout ce qui décrit un statut vit donc ici : libellé, couleur de pastille, et
// les transitions que l'administration a le droit de déclencher.

/**
 * Cycle de vie métier, tel que le client l'a décrit :
 *
 *   Créée  →  Validée  →  Terminée
 *
 * - `pending_validation` (Créée) : le touriste a réservé, la place est retenue,
 *   mais l'opérateur n'a pas encore confirmé qu'il prend le groupe. La mise en
 *   relation étant manuelle, c'est l'état réel de toute réservation neuve.
 * - `confirmed` (Validée) : information transmise à l'opérateur ET validée par
 *   lui. C'est l'admin qui le constate, depuis /admin/bookings.
 * - `completed` (Terminée) : le départ a eu lieu.
 *
 * `cancelled` reste atteignable à tout moment tant que le départ n'est pas
 * passé — ce n'est pas une étape du cycle, c'est une sortie.
 *
 * `pending_payment` et `expired` survivent sans être écrits par personne : ils
 * sont RÉSERVÉS à l'arrivée de Stripe. Les recycler pour « Créée » aurait fait
 * porter deux sens au même état le jour où le paiement arrive — c'est
 * précisément pourquoi `pending_validation` a été ajouté plutôt que réutilisé.
 */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_validation: 'Créée',
  confirmed: 'Validée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  pending_payment: 'En attente de paiement',
  expired: 'Expirée',
}

/** Pastille. Volontairement identiques d'un écran à l'autre. */
export const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  pending_validation: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  expired: 'bg-muted/20 text-muted',
}

/**
 * Ce que l'administration peut faire, depuis chaque état.
 *
 * Déclaré en données plutôt qu'en cascade de `if` : l'écran dessine ses boutons
 * à partir de cette table, et le serveur REFUSE tout ce qui n'y figure pas. Une
 * liste dupliquée côté client aurait fini par proposer un bouton que la
 * procédure rejette.
 *
 * On ne revient jamais en arrière — pas de `confirmed → pending_validation`.
 * Une réservation dont on a dit à l'opérateur qu'elle était validée ne se
 * dé-valide pas d'un clic : elle s'annule, et ça se voit.
 */
/**
 * Les seuls états que l'administration peut POSER.
 *
 * `pending_payment` et `expired` en sont exclus par construction : ils
 * appartiennent au paiement, que rien n'écrit encore. Le type est exporté pour
 * que le schéma Zod et les boutons de l'écran s'y accrochent — trois listes
 * indépendantes finiraient par diverger, et l'écran proposerait un bouton que
 * la procédure rejette.
 */
export type AdminSettableStatus =
  | 'pending_validation'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

export const ADMIN_SETTABLE_STATUSES = [
  'pending_validation',
  'confirmed',
  'completed',
  'cancelled',
] as const satisfies readonly AdminSettableStatus[]

export const ADMIN_STATUS_TRANSITIONS: Record<
  BookingStatus,
  readonly AdminSettableStatus[]
> = {
  pending_validation: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  pending_payment: ['confirmed', 'cancelled'],
  expired: [],
}

export function canAdminMove(
  from: BookingStatus,
  to: AdminSettableStatus,
): boolean {
  return ADMIN_STATUS_TRANSITIONS[from].includes(to)
}

/**
 * Statuts qui retiennent une place sur le créneau.
 *
 * `pending_validation` en fait partie : la place est décomptée dès la création
 * (`spotsTaken` est incrémenté par l'UPDATE conditionnel), bien avant que
 * l'opérateur valide. L'oublier ici rouvrirait à la vente des places déjà
 * prises.
 */
export const ACTIVE_BOOKING_STATUSES = [
  'pending_validation',
  'pending_payment',
  'confirmed',
] as const satisfies readonly BookingStatus[]

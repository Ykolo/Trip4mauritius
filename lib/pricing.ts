// RULE-001 — fractionnement 20 % d'acompte / 80 % de solde sur place.
// Voir docs/TEST-reservation-flow.md.
//
// Fonction PURE et sans accès base : c'est ce qui la rend testable directement
// contre le Gherkin de la règle, sans monter de transaction.

/** Part du total encaissée immédiatement par la plateforme. */
export const DEPOSIT_RATE = 0.2

export interface BookingAmounts {
  totalPrice: number
  depositDue: number
  balanceDueOnSite: number
}

/**
 * Tout le calcul se fait en CENTIMES entiers.
 *
 * En flottants, `100.10 * 3 * 0.2` ne tombe pas rond et le solde reconstitué
 * ne redonne pas exactement le total : la contrainte
 * `CHECK (deposit_due + balance_due_on_site = total_price)` rejetterait
 * l'insertion, à raison. Le solde est donc DÉDUIT du total plutôt que calculé
 * séparément à 80 % — c'est ce qui garantit l'égalité par construction.
 *
 * La fonction multiplie un prix UNITAIRE par une quantité, et ne sait rien de
 * ce que l'unité représente. C'est ce qui lui permet de servir les deux modèles
 * de vente sans se dédoubler :
 *
 * - activité sur créneau → `(prix par personne, nombre de participants)` ;
 * - activité à la journée → `(prix du jour, nombre de jours facturés)`.
 *
 * Les paramètres s'appelaient `pricePerPerson` / `participants`, ce qui n'a
 * jamais été qu'un des deux usages — et aurait fini par faire écrire une
 * seconde fonction pour l'autre.
 */
export function computeBookingAmounts(
  pricePerUnit: number,
  units: number,
): BookingAmounts {
  const totalCents = Math.round(pricePerUnit * 100) * units
  const depositCents = Math.round(totalCents * DEPOSIT_RATE)

  return {
    totalPrice: totalCents / 100,
    depositDue: depositCents / 100,
    balanceDueOnSite: (totalCents - depositCents) / 100,
  }
}

/** Une journée de location, en millisecondes. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Nombre de jours FACTURÉS pour une période, en mode journée.
 *
 * Règle du client : toute tranche de 24 h entamée compte pour un jour entier.
 * 24 h → 1 jour, 25 h → 2 jours, 48 h → 2, 49 h → 3. C'est la tarification
 * usuelle de la location : rendre le véhicule avec une heure de retard coûte
 * une journée, et personne ne facture au prorata.
 *
 * Le plancher à 1 n'est pas une précaution défensive mais la règle elle-même :
 * une location d'une heure reste une location d'une journée. Il couvre au
 * passage la période nulle ou inversée, que `bookings_period_ordered` refuse
 * de toute façon en base.
 *
 * Fonction PURE, comme `computeBookingAmounts`, et pour la même raison : elle
 * sert le serveur À LA FOIS pour facturer et le client pour afficher le prix
 * avant réservation. Deux implémentations divergeraient sur la première
 * période à cheval.
 */
export function billedDays(startsAt: Date, endsAt: Date): number {
  const elapsed = endsAt.getTime() - startsAt.getTime()
  return Math.max(1, Math.ceil(elapsed / DAY_MS))
}

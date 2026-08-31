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
 */
export function computeBookingAmounts(
  pricePerPerson: number,
  participants: number,
): BookingAmounts {
  const totalCents = Math.round(pricePerPerson * 100) * participants
  const depositCents = Math.round(totalCents * DEPOSIT_RATE)

  return {
    totalPrice: totalCents / 100,
    depositDue: depositCents / 100,
    balanceDueOnSite: (totalCents - depositCents) / 100,
  }
}

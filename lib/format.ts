// Formatage monétaire, un seul point.
//
// Tout le projet est en EUR (le multi-devises est hors périmètre). Le
// formateur est instancié une fois : `Intl.NumberFormat` est coûteux à
// construire, et le recréer à chaque cellule d'un tableau se voit.

const eur = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function formatEUR(amount: number): string {
  return eur.format(amount)
}

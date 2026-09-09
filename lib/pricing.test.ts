import { describe, expect, it } from 'vitest'
import { billedDays, computeBookingAmounts } from '@/lib/pricing'

// RULE-001, transcrit depuis le Gherkin de docs/TEST-reservation-flow.md.

describe('computeBookingAmounts — RULE-001', () => {
  it('découpe 100 € × 2 en 200 / 40 / 160', () => {
    expect(computeBookingAmounts(100, 2)).toEqual({
      totalPrice: 200,
      depositDue: 40,
      balanceDueOnSite: 160,
    })
  })

  it('garde acompte + solde = total malgré les arrondis', () => {
    // 100,10 € × 3 = 300,30 € ; 20 % vaut 60,06 €. En flottants, le solde
    // calculé séparément à 80 % donne 240,239999… et la contrainte
    // `CHECK (deposit_due + balance_due_on_site = total_price)` rejetterait
    // l'insertion. C'est le cas que la règle « solde = total − acompte » existe
    // pour couvrir.
    const amounts = computeBookingAmounts(100.1, 3)

    expect(amounts.totalPrice).toBe(300.3)
    expect(amounts.depositDue).toBe(60.06)
    expect(amounts.balanceDueOnSite).toBe(240.24)
    expect(amounts.depositDue + amounts.balanceDueOnSite).toBeCloseTo(
      amounts.totalPrice,
      10,
    )
  })

  it("n'expose jamais plus de deux décimales", () => {
    for (const price of [33.33, 19.99, 0.01, 149.95]) {
      for (const participants of [1, 3, 7]) {
        const { totalPrice, depositDue, balanceDueOnSite } =
          computeBookingAmounts(price, participants)

        for (const amount of [totalPrice, depositDue, balanceDueOnSite]) {
          expect(Math.round(amount * 100)).toBeCloseTo(amount * 100, 6)
        }

        // La colonne est un Decimal(10,2) contraint : l'égalité doit tenir à
        // l'exactitude du centime, pas « à peu près ».
        expect(Math.round(depositDue * 100) + Math.round(balanceDueOnSite * 100))
          .toBe(Math.round(totalPrice * 100))
      }
    }
  })
})

// Tarification à la journée.
//
// Règle du client : « chaque 24h c'est le prix d'un jour (donc 25h = prix de
// 2 jours) ». C'est la tarification usuelle de la location — rendre le véhicule
// avec une heure de retard coûte une journée, personne ne facture au prorata.

describe('billedDays — toute tranche de 24 h entamée', () => {
  const HOUR = 60 * 60 * 1000
  const start = new Date('2026-10-01T08:00:00.000Z')

  function after(hours: number): Date {
    return new Date(start.getTime() + hours * HOUR)
  }

  it.each([
    [24, 1],
    // Le cas cité en toutes lettres par le client.
    [25, 2],
    [48, 2],
    [49, 3],
    [72, 3],
  ])('%i h se facturent %i jour(s)', (hours, expected) => {
    expect(billedDays(start, after(hours))).toBe(expected)
  })

  it('facture une journée entière pour une location d’une heure', () => {
    // Le plancher à 1 n'est pas une précaution défensive : c'est la règle.
    // Une location courte reste une location d'une journée.
    expect(billedDays(start, after(1))).toBe(1)
  })

  it('ne descend jamais sous 1, même sur une période nulle ou inversée', () => {
    // `bookings_period_ordered` refuse ces périodes en base et le service les
    // rejette avant d'arriver ici. Reste que la fonction est PURE et publique :
    // rendre 0 ou un négatif produirait un montant nul ou négatif, que
    // `bookings_amounts_non_negative` refuserait bien plus loin.
    expect(billedDays(start, start)).toBe(1)
    expect(billedDays(start, after(-5))).toBe(1)
  })

  it('compte en jours pleins, pas en jours calendaires', () => {
    // Du 1er à 22:00 au 2 à 01:00 : deux dates au calendrier, mais trois
    // heures. C'est UNE journée facturée. Compter les dates ferait payer deux
    // jours pour une soirée.
    const soir = new Date('2026-10-01T22:00:00.000Z')
    const lendemain = new Date('2026-10-02T01:00:00.000Z')
    expect(billedDays(soir, lendemain)).toBe(1)
  })
})

describe('computeBookingAmounts — mode journée', () => {
  it('multiplie le prix du JOUR par le nombre de jours', () => {
    // Même fonction que pour les créneaux : elle multiplie un prix unitaire par
    // une quantité et ne sait rien de ce que l'unité représente. C'est ce qui
    // lui évite de se dédoubler.
    expect(computeBookingAmounts(120, 2)).toEqual({
      totalPrice: 240,
      depositDue: 48,
      balanceDueOnSite: 192,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { computeBookingAmounts } from '@/lib/pricing'

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

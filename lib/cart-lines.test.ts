import { describe, expect, it } from 'vitest'
import { cartItemKey, cartItemUnits } from '@/lib/cart-lines'
import { computeBookingAmounts } from '@/lib/pricing'
import type { CartItem } from '@/types/cart'

// Ce que ces tests figent, c'est la RÈGLE DE TARIFICATION des deux modes de
// vente — la seule chose qui distingue vraiment une location d'une excursion
// une fois la ligne au panier. Le reste (rendu, clics) n'est pas testable ici.

const activity = {
  slug: 'jeep',
  title: 'Jeep Wrangler',
  imageUrl: '/images/jeep.jpg',
  operator: 'Loueur du Nord',
}

function slotLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    mode: 'slot',
    slotId: 'slot-1',
    activityId: 'act-1',
    activity,
    slot: { date: '2026-10-12', time: '09:00', endTime: '11:00' },
    participants: 3,
    pricePerUnit: 80,
    ...overrides,
  } as CartItem
}

function dailyLine(
  startDate: string,
  endDate: string,
  participants = 1,
): CartItem {
  return {
    mode: 'daily',
    activityId: 'act-jeep',
    activity,
    period: {
      startDate,
      startTime: '09:00',
      endDate,
      endTime: '18:00',
    },
    participants,
    pricePerUnit: 120,
  }
}

describe('clé de ligne', () => {
  it('distingue les deux modes par un préfixe', () => {
    expect(cartItemKey(slotLine())).toBe('slot:slot-1')
    expect(cartItemKey(dailyLine('2026-10-12', '2026-10-14'))).toMatch(
      /^daily:act-jeep:/,
    )
  })

  it('donne deux clés à deux périodes distinctes de la MÊME activité', () => {
    // Louer la même Jeep du 12 au 14 puis du 20 au 22 est légitime : la seconde
    // période ne doit pas écraser la première. Une clé réduite à l'activité
    // l'aurait fait, en silence.
    const premiere = dailyLine('2026-10-12', '2026-10-14')
    const seconde = dailyLine('2026-10-20', '2026-10-22')

    expect(cartItemKey(premiere)).not.toBe(cartItemKey(seconde))
  })

  it('donne la même clé à la même période, quel que soit le nombre d’occupants', () => {
    // Le nombre d'occupants s'AJUSTE sur une ligne existante, il n'en crée pas
    // une seconde : sinon un même véhicule figurerait deux fois au panier.
    expect(cartItemKey(dailyLine('2026-10-12', '2026-10-14', 1))).toBe(
      cartItemKey(dailyLine('2026-10-12', '2026-10-14', 4)),
    )
  })
})

describe('quantité facturée', () => {
  it('compte les PERSONNES sur un créneau', () => {
    expect(cartItemUnits(slotLine({ participants: 3 }))).toBe(3)
  })

  it('compte les JOURS sur une location, jamais les occupants', () => {
    // La règle du client : 2 jours de Jeep = 2 × le prix, qu'on soit 1 ou 4.
    // `maxParticipants` est le nombre de places du véhicule, pas un
    // multiplicateur — les confondre revient à facturer la voiture par siège.
    const seul = dailyLine('2026-10-12', '2026-10-13', 1)
    const quatre = dailyLine('2026-10-12', '2026-10-13', 4)

    expect(cartItemUnits(seul)).toBe(cartItemUnits(quatre))
    expect(computeBookingAmounts(seul.pricePerUnit, cartItemUnits(seul))).toEqual(
      computeBookingAmounts(quatre.pricePerUnit, cartItemUnits(quatre)),
    )
  })

  it('facture une journée entière pour une période d’un seul jour', () => {
    // 09:00 → 18:00, soit 9 h. La règle « toute tranche de 24 h entamée compte
    // pour un jour » donne 1, pas 0 — et surtout pas une période de durée nulle,
    // que `createDailyBooking` refuserait après tout le tunnel de commande.
    expect(cartItemUnits(dailyLine('2026-10-12', '2026-10-12'))).toBe(1)
  })

  it('compte trois jours du 12 au 14, comme les lit un loueur', () => {
    // Retrait le 12 à 09:00, retour le 14 à 18:00 = 57 h = 3 tranches entamées.
    // Ce sont bien les trois journées pendant lesquelles le véhicule n'est pas
    // chez le loueur. Les heures par défaut de `PeriodSelector` sont choisies
    // pour que ce compte tombe juste.
    expect(cartItemUnits(dailyLine('2026-10-12', '2026-10-14'))).toBe(3)
  })

  it('ne dépend pas du fuseau du navigateur', () => {
    // Les bornes sont construites avec le même décalage : seule leur différence
    // compte. Construites en heure locale, une période à cheval sur un
    // changement d'heure aurait gagné ou perdu un jour facturé.
    const original = process.env.TZ
    try {
      process.env.TZ = 'America/Los_Angeles'
      expect(cartItemUnits(dailyLine('2026-10-12', '2026-10-14'))).toBe(3)
      process.env.TZ = 'Pacific/Kiritimati'
      expect(cartItemUnits(dailyLine('2026-10-12', '2026-10-14'))).toBe(3)
    } finally {
      process.env.TZ = original
    }
  })
})

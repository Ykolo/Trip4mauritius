import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import { cancelBooking, createBookings, listMyBookings } from '@/server/services/booking'

// Tests d'intégration contre la branche Neon `dev`.
//
// Ils ne moquent PAS Prisma, et c'est tout l'intérêt : le seul bug que cette
// itération peut produire — la survente — naît de la concurrence réelle entre
// deux transactions Postgres. Un mock la rendrait invisible.
//
// Tout ce qui est créé ici porte le préfixe TEST_PREFIX et est supprimé après.

const TEST_PREFIX = 'vitest-booking-'

/** Ordre imposé par les clés étrangères : bookings (RESTRICT) avant slots. */
async function cleanup() {
  const activities = await db.activity.findMany({
    where: { slug: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const activityIds = activities.map((a) => a.id)

  if (activityIds.length > 0) {
    await db.booking.deleteMany({
      where: { slot: { activityId: { in: activityIds } } },
    })
    await db.activitySlot.deleteMany({
      where: { activityId: { in: activityIds } },
    })
    await db.activity.deleteMany({ where: { id: { in: activityIds } } })
  }

  await db.operator.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  })
  await db.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } })
}

async function makeTourists(count: number): Promise<string[]> {
  const users = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      db.user.create({
        data: {
          email: `${TEST_PREFIX}tourist-${i}-${Date.now()}@example.test`,
          name: `Touriste ${i}`,
        },
        select: { id: true },
      }),
    ),
  )
  return users.map((u) => u.id)
}

async function makeActivity(options: {
  pricePerPerson: number
  maxSpots: number
}) {
  const user = await db.user.create({
    data: {
      email: `${TEST_PREFIX}operator-${Date.now()}@example.test`,
      name: 'Opérateur de test',
      role: 'operator',
    },
  })

  const operator = await db.operator.create({
    data: { userId: user.id, displayName: 'Opérateur de test' },
  })

  const activity = await db.activity.create({
    data: {
      operatorId: operator.id,
      slug: `${TEST_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: 'Sortie de test',
      category: 'Test',
      region: 'North',
      duration: '2h',
      priceHt: options.pricePerPerson,
      maxParticipants: 20,
      status: 'published',
      description: { fr: 'x', en: 'x', de: 'x', es: 'x', ru: 'x' },
    },
  })

  const slot = await db.activitySlot.create({
    data: {
      activityId: activity.id,
      // Demain : `createBookings` refuse les départs passés.
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxSpots: options.maxSpots,
    },
  })

  return { activity, slot }
}

beforeEach(cleanup)
afterAll(cleanup)

describe('createBookings — concurrence', () => {
  it('sur un créneau à 1 place, 8 réservations simultanées : une seule passe', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 1 })
    const touristIds = await makeTourists(8)

    // Toutes parties ensemble, sans await intermédiaire : c'est bien 8
    // transactions en vol au même instant, pas 8 appels en file.
    const results = await Promise.allSettled(
      touristIds.map((userId) =>
        createBookings({
          userId,
          lines: [{ slotId: slot.id, participants: 1 }],
          contactPhone: '+230 5000 0000',
        }),
      ),
    )

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(7)

    // Les 7 échecs doivent être des CONFLICT explicites — pas des erreurs de
    // contrainte remontées brutes, ni des deadlocks Postgres.
    for (const failure of rejected) {
      const reason = (failure as PromiseRejectedResult).reason
      expect(reason).toBeInstanceOf(TRPCError)
      expect((reason as TRPCError).code).toBe('CONFLICT')
    }

    const after = await db.activitySlot.findUniqueOrThrow({
      where: { id: slot.id },
    })
    expect(after.spotsTaken).toBe(1)
    expect(await db.booking.count({ where: { slotId: slot.id } })).toBe(1)
  })

  it('ne survend pas quand les paniers demandent plusieurs places', async () => {
    // 10 places, 8 touristes qui en demandent 3 chacun : au plus 3 peuvent
    // passer (9 places), la 4e demande ne tient pas dans le reste.
    const { slot } = await makeActivity({ pricePerPerson: 50, maxSpots: 10 })
    const touristIds = await makeTourists(8)

    await Promise.allSettled(
      touristIds.map((userId) =>
        createBookings({
          userId,
          lines: [{ slotId: slot.id, participants: 3 }],
          contactPhone: '+230 5000 0000',
        }),
      ),
    )

    const after = await db.activitySlot.findUniqueOrThrow({
      where: { id: slot.id },
    })

    expect(after.spotsTaken).toBe(9)
    expect(after.spotsTaken).toBeLessThanOrEqual(after.maxSpots)
  })
})

describe('createBookings — montants et référence', () => {
  it('applique RULE-001 avec le prix de la BASE, pas celui du client', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 10 })
    const [userId] = await makeTourists(1)

    const result = await createBookings({
      userId,
      lines: [{ slotId: slot.id, participants: 2 }],
      contactPhone: '+230 5000 0000',
    })

    const booking = result.bookings[0]
    expect(booking.totalPrice).toBe(200)
    expect(booking.depositDue).toBe(40)
    expect(booking.balanceDueOnSite).toBe(160)
    expect(booking.bookingRef).toMatch(/^MX-\d{4}-\d{6}$/)
  })

  it('donne des références distinctes à des réservations simultanées', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 20, maxSpots: 50 })
    const touristIds = await makeTourists(6)

    const results = await Promise.all(
      touristIds.map((userId) =>
        createBookings({
          userId,
          lines: [{ slotId: slot.id, participants: 1 }],
          contactPhone: '+230 5000 0000',
        }),
      ),
    )

    const refs = results.map((r) => r.bookingRef)
    // C'est ce qu'un `count() + 1` casserait silencieusement.
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('adopte le téléphone comme défaut du profil sans écraser un existant', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 20, maxSpots: 10 })
    const [freshId] = await makeTourists(1)

    await createBookings({
      userId: freshId,
      lines: [{ slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5111 1111',
    })

    const adopted = await db.user.findUniqueOrThrow({ where: { id: freshId } })
    expect(adopted.phone).toBe('+230 5111 1111')

    // Deuxième réservation avec un AUTRE numéro : le profil ne doit pas bouger.
    const { slot: otherSlot } = await makeActivity({
      pricePerPerson: 20,
      maxSpots: 10,
    })
    await createBookings({
      userId: freshId,
      lines: [{ slotId: otherSlot.id, participants: 1 }],
      contactPhone: '+230 5222 2222',
    })

    const unchanged = await db.user.findUniqueOrThrow({ where: { id: freshId } })
    expect(unchanged.phone).toBe('+230 5111 1111')
  })
})

describe('createBookings — garde-fou anti-abus', () => {
  it('refuse une seconde réservation active du même compte sur le même créneau', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 30, maxSpots: 20 })
    const [userId] = await makeTourists(1)

    await createBookings({
      userId,
      lines: [{ slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId,
        lines: [{ slotId: slot.id, participants: 1 }],
        contactPhone: '+230 5000 0000',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    // Le refus doit aussi ANNULER l'incrément : sans rollback, la seconde
    // tentative aurait consommé une place au passage.
    const after = await db.activitySlot.findUniqueOrThrow({
      where: { id: slot.id },
    })
    expect(after.spotsTaken).toBe(1)
  })

  it('tient face à un double-clic (deux créations vraiment simultanées)', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 30, maxSpots: 20 })
    const [userId] = await makeTourists(1)

    const results = await Promise.allSettled([
      createBookings({
        userId,
        lines: [{ slotId: slot.id, participants: 1 }],
        contactPhone: '+230 5000 0000',
      }),
      createBookings({
        userId,
        lines: [{ slotId: slot.id, participants: 1 }],
        contactPhone: '+230 5000 0000',
      }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const after = await db.activitySlot.findUniqueOrThrow({
      where: { id: slot.id },
    })
    expect(after.spotsTaken).toBe(1)
  })
})

describe('createBookings — panier multi-activités', () => {
  it('annule TOUT le panier si une seule ligne est complète', async () => {
    const roomy = await makeActivity({ pricePerPerson: 40, maxSpots: 10 })
    const full = await makeActivity({ pricePerPerson: 40, maxSpots: 1 })
    const [blocker, userId] = await makeTourists(2)

    // Un autre touriste prend l'unique place du second créneau.
    await createBookings({
      userId: blocker,
      lines: [{ slotId: full.slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId,
        lines: [
          { slotId: roomy.slot.id, participants: 2 },
          { slotId: full.slot.id, participants: 1 },
        ],
        contactPhone: '+230 5000 0000',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    // La place du créneau disponible ne doit pas être restée consommée : une
    // transaction partiellement appliquée fuirait de l'inventaire.
    const roomyAfter = await db.activitySlot.findUniqueOrThrow({
      where: { id: roomy.slot.id },
    })
    expect(roomyAfter.spotsTaken).toBe(0)
    expect(await listMyBookings(userId)).toHaveLength(0)
  })
})

describe('cancelBooking', () => {
  it('rend la place, qui redevient réservable', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 1 })
    const [first, second] = await makeTourists(2)

    const created = await createBookings({
      userId: first,
      lines: [{ slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    // Créneau plein : le second se heurte au mur.
    await expect(
      createBookings({
        userId: second,
        lines: [{ slotId: slot.id, participants: 1 }],
        contactPhone: '+230 5000 0000',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    await cancelBooking({ userId: first, bookingId: created.bookings[0].id })

    expect(
      (await db.activitySlot.findUniqueOrThrow({ where: { id: slot.id } }))
        .spotsTaken,
    ).toBe(0)

    // Le vrai critère : la place est REVENDUE, pas seulement décomptée.
    const resold = await createBookings({
      userId: second,
      lines: [{ slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })
    expect(resold.bookings).toHaveLength(1)
  })

  it('ne libère les places qu\'une fois malgré deux annulations simultanées', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 5 })
    const [userId] = await makeTourists(1)

    const created = await createBookings({
      userId,
      lines: [{ slotId: slot.id, participants: 3 }],
      contactPhone: '+230 5000 0000',
    })
    const bookingId = created.bookings[0].id

    const results = await Promise.allSettled([
      cancelBooking({ userId, bookingId }),
      cancelBooking({ userId, bookingId }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    // 3 places rendues, pas 6 : un double décrément ferait paraître le créneau
    // plus vide qu'il ne l'est et finirait par violer le CHECK spotsTaken >= 0.
    expect(
      (await db.activitySlot.findUniqueOrThrow({ where: { id: slot.id } }))
        .spotsTaken,
    ).toBe(0)
  })

  it("refuse d'annuler la réservation d'un autre compte", async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 5 })
    const [owner, intruder] = await makeTourists(2)

    const created = await createBookings({
      userId: owner,
      lines: [{ slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    // Deviner l'id ne doit rien donner : le filtre par userId est dans le WHERE.
    await expect(
      cancelBooking({ userId: intruder, bookingId: created.bookings[0].id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(
      (await db.activitySlot.findUniqueOrThrow({ where: { id: slot.id } }))
        .spotsTaken,
    ).toBe(1)
  })
})

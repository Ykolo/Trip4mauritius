import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import { cancelBooking, createBookings, listMyBookings } from '@/server/services/booking'
import { testCategoryId } from '@/server/services/test-support'

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
    // Par `activityId` et non par le créneau : une location à la journée n'en
    // a pas, elle survivrait au nettoyage et ferait échouer la suppression de
    // l'activité sur `bookings_activityId_fkey` (RESTRICT).
    await db.booking.deleteMany({ where: { activityId: { in: activityIds } } })
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
      categoryId: await testCategoryId(),
      region: 'North',
      duration: '< 2h',
      durationMinutes: 90,
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

/**
 * Une activité à la journée — une location, avec son stock.
 *
 * Pas de créneau : c'est précisément ce qui la distingue. La disponibilité s'y
 * calcule en comptant les réservations actives dont la période chevauche celle
 * demandée, contre `dailyUnits`.
 */
async function makeDailyActivity(options: {
  pricePerDay: number
  units: number
}) {
  const user = await db.user.create({
    data: {
      email: `${TEST_PREFIX}loueur-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`,
      name: 'Loueur de test',
      role: 'operator',
    },
  })

  const operator = await db.operator.create({
    data: { userId: user.id, displayName: 'Loueur de test' },
  })

  return db.activity.create({
    data: {
      operatorId: operator.id,
      slug: `${TEST_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: 'Jeep de test',
      categoryId: await testCategoryId(),
      region: 'North',
      bookingMode: 'daily',
      // En mode journée, `durationMinutes` doit rester nul et `dailyUnits`
      // renseigné : c'est ce qu'imposent les deux CHECK du lot B.
      duration: 'Journée',
      dailyUnits: options.units,
      priceHt: options.pricePerDay,
      // Les places du VÉHICULE, pas le nombre d'exemplaires. Les confondre est
      // exactement le contresens que `dailyUnits` existe pour éviter.
      maxParticipants: 4,
      status: 'published',
      description: { fr: 'x', en: 'x', de: 'x', es: 'x', ru: 'x' },
    },
  })
}

/** Une date mauricienne à J+n, au format que consomment les lignes journée. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

/** Une ligne de panier « journée », du jour J+from au jour J+to. */
function dailyLine(activityId: string, from: number, to: number, participants = 2) {
  return {
    mode: 'daily' as const,
    activityId,
    startDate: inDays(from),
    startTime: '09:00',
    endDate: inDays(to),
    endTime: '09:00',
    participants,
  }
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
          lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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
          lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 3 }],
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
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 2 }],
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
          lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
          contactPhone: '+230 5000 0000',
        }),
      ),
    )

    const refs = results.flatMap((r) => r.bookings.map((b) => b.bookingRef))
    // C'est ce qu'un `count() + 1` casserait silencieusement.
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('rend une référence PAR activité du panier, pas une seule', async () => {
    // Le régression que ce test verrouille : `createBookings` exposait un
    // `bookingRef` au singulier — celui de la première ligne — et l'écran de
    // confirmation n'affichait que lui. Le touriste repartait avec un code sur
    // deux, quand l'admin en voyait bien deux.
    const first = await makeActivity({ pricePerPerson: 100, maxSpots: 10 })
    const second = await makeActivity({ pricePerPerson: 50, maxSpots: 10 })
    const [userId] = await makeTourists(1)

    const result = await createBookings({
      userId,
      lines: [
        { mode: 'slot' as const, slotId: first.slot.id, participants: 2 },
        { mode: 'slot' as const, slotId: second.slot.id, participants: 1 },
      ],
      contactPhone: '+230 5000 0000',
    })

    expect(result.bookings).toHaveLength(2)
    const refs = result.bookings.map((b) => b.bookingRef)
    expect(new Set(refs).size).toBe(2)
    for (const ref of refs) expect(ref).toMatch(/^MX-\d{4}-\d{6}$/)
    // 20 % de (2 × 100) + 20 % de (1 × 50)
    expect(result.totalDeposit).toBe(50)
  })

  it('adopte le téléphone comme défaut du profil sans écraser un existant', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 20, maxSpots: 10 })
    const [freshId] = await makeTourists(1)

    await createBookings({
      userId: freshId,
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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
      lines: [{ mode: 'slot' as const, slotId: otherSlot.id, participants: 1 }],
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
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId,
        lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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
        lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
        contactPhone: '+230 5000 0000',
      }),
      createBookings({
        userId,
        lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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
      lines: [{ mode: 'slot' as const, slotId: full.slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId,
        lines: [
          { mode: 'slot' as const, slotId: roomy.slot.id, participants: 2 },
          { mode: 'slot' as const, slotId: full.slot.id, participants: 1 },
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
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    // Créneau plein : le second se heurte au mur.
    await expect(
      createBookings({
        userId: second,
        lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })
    expect(resold.bookings).toHaveLength(1)
  })

  it('ne libère les places qu\'une fois malgré deux annulations simultanées', async () => {
    const { slot } = await makeActivity({ pricePerPerson: 100, maxSpots: 5 })
    const [userId] = await makeTourists(1)

    const created = await createBookings({
      userId,
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 3 }],
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
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 1 }],
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

// ---------------------------------------------------------------------------
// Activités à la journée
// ---------------------------------------------------------------------------
//
// Le risque y est le même qu'ailleurs — promettre deux fois la même chose —
// mais il ne se traite pas de la même façon. Il n'y a aucun compteur à
// incrémenter : le stock est une capacité qu'on compare au nombre de
// réservations qui SE CHEVAUCHENT. C'est le `SELECT … FOR UPDATE` sur la ligne
// de l'activité qui sérialise les demandes concurrentes, et c'est lui que ces
// tests mettent sous pression.

describe('createBookings — location à la journée', () => {
  it('facture le prix du JOUR, indépendamment du nombre de participants', async () => {
    const activity = await makeDailyActivity({ pricePerDay: 120, units: 1 })
    const [seul, groupe] = await makeTourists(2)

    const solo = await createBookings({
      userId: seul,
      lines: [dailyLine(activity.id, 1, 3, 1)],
      contactPhone: '+230 5000 0000',
    })

    // 48 h = 2 jours : 240 €, dont 20 % d'acompte. Le second client prend la
    // même période à 4 personnes sur une autre activité identique — le montant
    // ne doit pas bouger d'un centime.
    expect(solo.bookings[0].totalPrice).toBe(240)
    expect(solo.bookings[0].depositDue).toBe(48)
    expect(solo.bookings[0].billedDays).toBe(2)

    const autre = await makeDailyActivity({ pricePerDay: 120, units: 1 })
    const quatre = await createBookings({
      userId: groupe,
      lines: [dailyLine(autre.id, 1, 3, 4)],
      contactPhone: '+230 5000 0001',
    })

    expect(quatre.bookings[0].totalPrice).toBe(240)
  })

  it('arrondit au jour SUPÉRIEUR — 25 h se facturent 2 jours', async () => {
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [tourist] = await makeTourists(1)

    const result = await createBookings({
      userId: tourist,
      lines: [
        {
          mode: 'daily' as const,
          activityId: activity.id,
          startDate: inDays(1),
          startTime: '09:00',
          endDate: inDays(2),
          // 24 h + 1 h : le cas cité en toutes lettres par le client.
          endTime: '10:00',
          participants: 2,
        },
      ],
      contactPhone: '+230 5000 0000',
    })

    expect(result.bookings[0].billedDays).toBe(2)
    expect(result.bookings[0].totalPrice).toBe(200)
  })

  it('rend une réservation SANS créneau, avec sa période', async () => {
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [tourist] = await makeTourists(1)

    await createBookings({
      userId: tourist,
      lines: [dailyLine(activity.id, 1, 3)],
      contactPhone: '+230 5000 0000',
    })

    // `bookings_mode_shape` refuserait toute ligne bâtarde : soit un créneau
    // sans période, soit une période sans créneau.
    const row = await db.booking.findFirstOrThrow({
      where: { activityId: activity.id },
    })
    expect(row.slotId).toBeNull()
    expect(row.endsAt).not.toBeNull()
    expect(row.billedDays).toBe(2)

    const [mine] = await listMyBookings(tourist)
    expect(mine.mode).toBe('daily')
    expect(mine.endDate).not.toBeNull()
  })
})

describe('createBookings — disponibilité à la journée', () => {
  it('laisse passer deux périodes DISJOINTES sur une seule unité', async () => {
    // Le cœur du modèle : une Jeep louée du 12 au 14 reste libre le 20. Un
    // compteur global de places ne saurait pas exprimer ça.
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [a, b] = await makeTourists(2)

    await createBookings({
      userId: a,
      lines: [dailyLine(activity.id, 1, 3)],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId: b,
        lines: [dailyLine(activity.id, 5, 7)],
        contactPhone: '+230 5000 0001',
      }),
    ).resolves.toBeDefined()

    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(2)
  })

  it('refuse une période qui CHEVAUCHE la seule unité disponible', async () => {
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [a, b] = await makeTourists(2)

    await createBookings({
      userId: a,
      lines: [dailyLine(activity.id, 1, 5)],
      contactPhone: '+230 5000 0000',
    })

    // Chevauchement partiel : le 3 est demandé par les deux.
    await expect(
      createBookings({
        userId: b,
        lines: [dailyLine(activity.id, 3, 7)],
        contactPhone: '+230 5000 0001',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(1)
  })

  it('ne loue pas deux fois la même voiture, même en concurrence', async () => {
    // LE test du lot B. Sans le `SELECT … FOR UPDATE`, les deux transactions
    // compteraient simultanément « 0 réservation sur ces dates » et
    // repartiraient toutes les deux avec la Jeep.
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const tourists = await makeTourists(6)

    const results = await Promise.allSettled(
      tourists.map((t, i) =>
        createBookings({
          userId: t,
          lines: [dailyLine(activity.id, 1, 4)],
          contactPhone: `+230 5000 000${i}`,
        }),
      ),
    )

    const acceptées = results.filter((r) => r.status === 'fulfilled')
    expect(acceptées).toHaveLength(1)

    for (const rejet of results.filter((r) => r.status === 'rejected')) {
      expect((rejet.reason as TRPCError).code).toBe('CONFLICT')
    }

    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(1)
  })

  it('honore un stock de 2, et refuse la troisième', async () => {
    // Le stock n'est pas un booléen : deux exemplaires acceptent deux
    // locations simultanées, et exactement deux.
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 2 })
    const [a, b, c] = await makeTourists(3)

    for (const tourist of [a, b]) {
      await createBookings({
        userId: tourist,
        lines: [dailyLine(activity.id, 1, 4)],
        contactPhone: '+230 5000 0000',
      })
    }

    await expect(
      createBookings({
        userId: c,
        lines: [dailyLine(activity.id, 2, 3)],
        contactPhone: '+230 5000 0002',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(2)
  })

  it('empêche un même compte d’empiler deux locations qui se chevauchent', async () => {
    // Garde-fou anti-abus, transposé des créneaux : tant que rien n'est payé,
    // un compte pourrait bloquer un véhicule en enchaînant les demandes.
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 5 })
    const [tourist] = await makeTourists(1)

    await createBookings({
      userId: tourist,
      lines: [dailyLine(activity.id, 1, 5)],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId: tourist,
        lines: [dailyLine(activity.id, 2, 6)],
        contactPhone: '+230 5000 0000',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('refuse deux lignes du même panier qui se chevauchent', async () => {
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 5 })
    const [tourist] = await makeTourists(1)

    await expect(
      createBookings({
        userId: tourist,
        lines: [dailyLine(activity.id, 1, 5), dailyLine(activity.id, 3, 8)],
        contactPhone: '+230 5000 0000',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(0)
  })

  it('libère la période à l’annulation', async () => {
    // Il n'y a aucun compteur à recréditer : la période redevient libre du seul
    // fait que le statut n'est plus actif. C'est ce que ce test prouve.
    const activity = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [a, b] = await makeTourists(2)

    const first = await createBookings({
      userId: a,
      lines: [dailyLine(activity.id, 1, 4)],
      contactPhone: '+230 5000 0000',
    })

    await cancelBooking({ userId: a, bookingId: first.bookings[0].id })

    await expect(
      createBookings({
        userId: b,
        lines: [dailyLine(activity.id, 1, 4)],
        contactPhone: '+230 5000 0001',
      }),
    ).resolves.toBeDefined()
  })
})

describe('createBookings — panier mixte créneau + journée', () => {
  it('crée les deux formes dans une seule transaction', async () => {
    const { activity, slot } = await makeActivity({
      pricePerPerson: 50,
      maxSpots: 10,
    })
    const location = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [tourist] = await makeTourists(1)

    const result = await createBookings({
      userId: tourist,
      lines: [
        { mode: 'slot' as const, slotId: slot.id, participants: 2 },
        dailyLine(location.id, 1, 3),
      ],
      contactPhone: '+230 5000 0000',
    })

    expect(result.bookings).toHaveLength(2)
    expect(result.bookings.map((b) => b.mode).sort()).toEqual(['daily', 'slot'])
    // Deux réservations, deux références : il n'y a pas de « commande » ici.
    expect(new Set(result.bookings.map((b) => b.bookingRef)).size).toBe(2)
    expect(await db.booking.count({ where: { activityId: activity.id } })).toBe(1)
  })

  it('annule TOUT si la ligne journée échoue', async () => {
    // Le rollback doit couvrir les deux formes. Sans transaction unique, le
    // créneau serait décompté et la location refusée — une place perdue.
    const { slot } = await makeActivity({ pricePerPerson: 50, maxSpots: 10 })
    const location = await makeDailyActivity({ pricePerDay: 100, units: 1 })
    const [a, b] = await makeTourists(2)

    await createBookings({
      userId: a,
      lines: [dailyLine(location.id, 1, 4)],
      contactPhone: '+230 5000 0000',
    })

    await expect(
      createBookings({
        userId: b,
        lines: [
          { mode: 'slot' as const, slotId: slot.id, participants: 2 },
          dailyLine(location.id, 2, 3),
        ],
        contactPhone: '+230 5000 0001',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const after = await db.activitySlot.findUniqueOrThrow({ where: { id: slot.id } })
    expect(after.spotsTaken).toBe(0)
  })
})

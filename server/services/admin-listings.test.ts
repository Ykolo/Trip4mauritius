import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { listBookingsForAdmin, listUsersForAdmin } from '@/server/services/admin'
import { createBookings } from '@/server/services/booking'
import { testCategoryId } from '@/server/services/test-support'
import { createCaller } from '@/server/trpc/root'
import { FEATURE_DEFAULTS } from '@/lib/features'

// Listings du back-office : ce que l'admin voit, et ce que personne d'autre ne
// doit voir.

const TEST_PREFIX = 'vitest-listing-'

async function cleanup() {
  const activities = await db.activity.findMany({
    where: { slug: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const ids = activities.map((a) => a.id)

  if (ids.length > 0) {
    await db.booking.deleteMany({ where: { slot: { activityId: { in: ids } } } })
    await db.activitySlot.deleteMany({ where: { activityId: { in: ids } } })
    await db.activity.deleteMany({ where: { id: { in: ids } } })
  }

  await db.operator.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  })
  await db.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } })
}

beforeEach(cleanup)
afterEach(cleanup)

/** Un départ à venir, réservé — de quoi peupler les deux listings. */
async function bookedDeparture(label: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const tourist = await db.user.create({
    data: {
      email: `${TEST_PREFIX}tourist-${label}-${stamp}@example.test`,
      name: `Touriste ${label}`,
    },
  })

  const operatorUser = await db.user.create({
    data: {
      email: `${TEST_PREFIX}operator-${label}-${stamp}@example.test`,
      name: `Compte pro ${label}`,
      role: 'operator',
    },
  })

  const operator = await db.operator.create({
    data: { userId: operatorUser.id, displayName: `Enseigne ${label}` },
  })

  const activity = await db.activity.create({
    data: {
      operatorId: operator.id,
      categoryId: await testCategoryId(),
      slug: `${TEST_PREFIX}${stamp}`,
      title: `Sortie ${label}`,
      region: 'North',
      duration: '2h',
      priceHt: 100,
      maxParticipants: 20,
      status: 'published',
      description: { fr: 'x' },
    },
  })

  const slot = await db.activitySlot.create({
    data: {
      activityId: activity.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxSpots: 10,
    },
  })

  const { bookings } = await createBookings({
    userId: tourist.id,
    lines: [{ slotId: slot.id, participants: 2 }],
    contactPhone: '+23057000000',
  })

  return { tourist, operatorUser, operator, activity, slot, booking: bookings[0] }
}

describe('listing des réservations', () => {
  it('réunit les DEUX contacts sur une même ligne', async () => {
    // C'est toute la raison d'être de l'écran : sans les deux, l'admin doit
    // ouvrir la base pour mettre le touriste et l'opérateur en relation.
    const ctx = await bookedDeparture('a')

    const { bookings } = await listBookingsForAdmin({
      page: 1,
      status: 'all',
      period: 'upcoming',
      search: ctx.booking.bookingRef,
    })

    expect(bookings).toHaveLength(1)
    expect(bookings[0]).toMatchObject({
      bookingRef: ctx.booking.bookingRef,
      touristEmail: ctx.tourist.email,
      contactPhone: '+23057000000',
      operatorName: ctx.operator.displayName,
      operatorEmail: ctx.operatorUser.email,
      departed: false,
    })
  })

  it('cherche indifféremment par référence, par nom ou par email', async () => {
    const ctx = await bookedDeparture('b')
    const base = { page: 1 as const, status: 'all' as const, period: 'all' as const }

    for (const term of [
      ctx.booking.bookingRef,
      ctx.tourist.email,
      `Touriste b`,
    ]) {
      const { bookings } = await listBookingsForAdmin({ ...base, search: term })
      expect(
        bookings.some((b) => b.bookingRef === ctx.booking.bookingRef),
        `recherche « ${term} »`,
      ).toBe(true)
    }
  })

  it("sépare les départs à venir du passé", async () => {
    const ctx = await bookedDeparture('c')

    const upcoming = await listBookingsForAdmin({
      page: 1,
      status: 'all',
      period: 'upcoming',
      search: ctx.booking.bookingRef,
    })
    expect(upcoming.total).toBe(1)

    const past = await listBookingsForAdmin({
      page: 1,
      status: 'all',
      period: 'past',
      search: ctx.booking.bookingRef,
    })
    expect(past.total).toBe(0)
  })

  it('filtre par statut', async () => {
    const ctx = await bookedDeparture('d')
    const base = {
      page: 1 as const,
      period: 'all' as const,
      search: ctx.booking.bookingRef,
    }

    expect(
      (await listBookingsForAdmin({ ...base, status: 'confirmed' })).total,
    ).toBe(1)
    expect(
      (await listBookingsForAdmin({ ...base, status: 'cancelled' })).total,
    ).toBe(0)
  })
})

describe('listing des comptes', () => {
  it("montre le nom commercial et le nombre de réservations", async () => {
    const ctx = await bookedDeparture('e')

    const { users } = await listUsersForAdmin({
      page: 1,
      role: 'all',
      search: ctx.tourist.email,
    })
    expect(users[0]).toMatchObject({
      email: ctx.tourist.email,
      role: 'tourist',
      bookingsCount: 1,
      operatorName: null,
    })

    const pro = await listUsersForAdmin({
      page: 1,
      role: 'all',
      search: ctx.operatorUser.email,
    })
    expect(pro.users[0]).toMatchObject({
      role: 'operator',
      operatorName: ctx.operator.displayName,
    })
  })

  it('filtre par rôle', async () => {
    const ctx = await bookedDeparture('f')

    const tourists = await listUsersForAdmin({
      page: 1,
      role: 'tourist',
      search: ctx.operatorUser.email,
    })
    expect(tourists.total).toBe(0)
  })
})

describe('cloisonnement', () => {
  // Ces deux listings exposent les coordonnées de TOUS les touristes et de tous
  // les opérateurs. Une procédure laissée en `protectedProcedure` par
  // distraction les ouvrirait à n'importe quel compte connecté.
  function callerAs(role: 'tourist' | 'operator') {
    return createCaller({
      db,
      headers: new Headers(),
      user: {
        id: 'utilisateur-test',
        email: `${TEST_PREFIX}intrus@example.test`,
        name: 'Intrus',
        role,
      },
      features: { ...FEATURE_DEFAULTS },
    })
  }

  it.each(['tourist', 'operator'] as const)(
    'refuse admin.bookings et admin.users à un compte %s',
    async (role) => {
      await expect(
        callerAs(role).admin.bookings({ page: 1, status: 'all', period: 'all' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      await expect(
        callerAs(role).admin.users({ page: 1, role: 'all' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    },
  )
})

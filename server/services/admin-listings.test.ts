import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TRPCError } from '@trpc/server'
import { db } from '@/lib/db'
import {
  listBookingsForAdmin,
  setBookingStatus,
} from '@/server/services/admin'
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
      duration: '< 2h',
      durationMinutes: 90,
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
    lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 2 }],
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

    // Une réservation neuve naît « Créée », pas « Validée » : la mise en
    // relation avec l'opérateur est manuelle, personne ne l'a encore joint.
    expect(
      (await listBookingsForAdmin({ ...base, status: 'pending_validation' }))
        .total,
    ).toBe(1)
    expect(
      (await listBookingsForAdmin({ ...base, status: 'confirmed' })).total,
    ).toBe(0)
    expect(
      (await listBookingsForAdmin({ ...base, status: 'cancelled' })).total,
    ).toBe(0)
  })
})

describe('cycle de vie des réservations', () => {
  it('suit Créée → Validée → Terminée', async () => {
    const ctx = await bookedDeparture('lifecycle')
    expect(ctx.booking.status).toBe('pending_validation')

    const validated = await setBookingStatus({
      bookingId: ctx.booking.id,
      status: 'confirmed',
    })
    expect(validated.status).toBe('confirmed')

    const done = await setBookingStatus({
      bookingId: ctx.booking.id,
      status: 'completed',
    })
    expect(done.status).toBe('completed')
  })

  it('refuse les sauts et les retours en arrière', async () => {
    const ctx = await bookedDeparture('jumps')

    // Créée → Terminée : on ne termine pas ce qui n'a jamais été validé.
    await expect(
      setBookingStatus({ bookingId: ctx.booking.id, status: 'completed' }),
    ).rejects.toBeInstanceOf(TRPCError)

    await setBookingStatus({ bookingId: ctx.booking.id, status: 'confirmed' })

    // Validée → Créée : une réservation dont on a prévenu l'opérateur ne se
    // dé-valide pas d'un clic. Elle s'annule, et ça se voit.
    await expect(
      setBookingStatus({
        bookingId: ctx.booking.id,
        status: 'pending_validation',
      }),
    ).rejects.toBeInstanceOf(TRPCError)
  })

  it('rend les places quand l’admin annule', async () => {
    // C'est le piège de cette mutation : `cancelBooking` libère les places,
    // et un second chemin vers `cancelled` qui ne le ferait pas viderait
    // l'inventaire sans jamais le revendre.
    const ctx = await bookedDeparture('release')
    const before = await db.activitySlot.findUniqueOrThrow({
      where: { id: ctx.slot.id },
    })
    expect(before.spotsTaken).toBe(2)

    await setBookingStatus({ bookingId: ctx.booking.id, status: 'cancelled' })

    const after = await db.activitySlot.findUniqueOrThrow({
      where: { id: ctx.slot.id },
    })
    expect(after.spotsTaken).toBe(0)

    // Seconde annulation : non-opération, pas une erreur — le service sort
    // avant l'UPDATE quand l'état demandé est déjà l'état courant. C'est ce
    // qui protège du double-clic. Ce qui doit rester vrai, et que la suite
    // vérifie, c'est que les places ne sont PAS rendues deux fois.
    const again = await setBookingStatus({
      bookingId: ctx.booking.id,
      status: 'cancelled',
    })
    expect(again.status).toBe('cancelled')

    const stable = await db.activitySlot.findUniqueOrThrow({
      where: { id: ctx.slot.id },
    })
    expect(stable.spotsTaken).toBe(0)
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
    'refuse admin.bookings et admin.operators à un compte %s',
    async (role) => {
      await expect(
        callerAs(role).admin.bookings({ page: 1, status: 'all', period: 'all' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      await expect(callerAs(role).admin.operators()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    },
  )

  // L'asymétrie qui compte : `admin` gère la plateforme mais ne touche pas aux
  // interrupteurs, qui décident de ce qu'il voit. Seul Kled les manœuvre.
  it('refuse les interrupteurs à un administrateur client', async () => {
    const asAdmin = createCaller({
      db,
      headers: new Headers(),
      user: {
        id: 'utilisateur-test',
        email: `${TEST_PREFIX}admin@example.test`,
        name: 'Admin client',
        role: 'admin',
      },
      features: { ...FEATURE_DEFAULTS },
    })

    await expect(asAdmin.admin.features()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    // La lecture des réservations, elle, doit rester ouverte : sinon le test
    // ci-dessus passerait pour une raison sans rapport.
    await expect(
      asAdmin.admin.bookings({ page: 1, status: 'all', period: 'all' }),
    ).resolves.toBeDefined()
  })
})

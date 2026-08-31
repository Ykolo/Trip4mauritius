import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createBookings } from '@/server/services/booking'
import {
  archiveActivity,
  createActivity,
  createSlots,
  deleteSlot,
  getOperatorActivity,
  listOperatorActivities,
  listOperatorBookings,
  requestOperatorAccess,
  submitForModeration,
  updateActivity,
} from '@/server/services/operator'
import { listActivities } from '@/server/services/activity'
import type { ActivityInput } from '@/lib/schemas/operator'

// Le cloisonnement est la propriété critique de ce lot : un opérateur ne doit
// jamais atteindre les données d'un autre, y compris en devinant un cuid. Ces
// tests montent DEUX opérateurs et vérifient que chacun reste chez lui.

const TEST_PREFIX = 'vitest-operator-'

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

async function makeOperator(label: string) {
  const user = await db.user.create({
    data: {
      email: `${TEST_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`,
      name: `Opérateur ${label}`,
      role: 'operator',
    },
  })
  const operator = await db.operator.create({
    data: { userId: user.id, displayName: `Opérateur ${label}` },
  })
  return { userId: user.id, operatorId: operator.id }
}

function activityInput(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return {
    // Le slug est dérivé du titre : ce préfixe est ce qui rend le nettoyage
    // possible.
    title: `${TEST_PREFIX}sortie ${Math.random().toString(36).slice(2, 8)}`,
    category: 'Nature',
    region: 'North',
    duration: '2 hours',
    description: { fr: 'Une sortie de test.' },
    priceHT: 80,
    maxParticipants: 12,
    languages: ['FR'],
    imageUrls: ['/images/hero.jpg'],
    included: [],
    excluded: [],
    ...overrides,
  }
}

/** Demain, pour ne jamais buter sur le refus des créneaux passés. */
function tomorrow(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

beforeEach(cleanup)
afterAll(cleanup)

describe('cloisonnement entre opérateurs', () => {
  it("A ne peut pas lire l'activité de B en devinant son id", async () => {
    const a = await makeOperator('a')
    const b = await makeOperator('b')

    const activityOfB = await createActivity(b.operatorId, activityInput())

    // A connaît l'id — c'est l'hypothèse du test, pas une faille en soi.
    await expect(
      getOperatorActivity(a.operatorId, activityOfB.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('la liste de A ne contient que les activités de A', async () => {
    const a = await makeOperator('a')
    const b = await makeOperator('b')

    const mine = await createActivity(a.operatorId, activityInput())
    await createActivity(b.operatorId, activityInput())

    const listed = await listOperatorActivities(a.operatorId)
    expect(listed.map((x) => x.id)).toEqual([mine.id])
  })

  it('A ne voit pas les réservations prises sur les activités de B', async () => {
    const a = await makeOperator('a')
    const b = await makeOperator('b')

    const activityOfB = await createActivity(b.operatorId, activityInput())
    // `createBookings` refuse tout créneau dont l'activité n'est pas publiée —
    // il faut donc la publier pour pouvoir réserver.
    await db.activity.update({
      where: { id: activityOfB.id },
      data: { status: 'published' },
    })
    await createSlots(b.operatorId, activityOfB.id, [
      { date: tomorrow(), time: '09:00', maxSpots: 10 },
    ])
    const withSlot = await getOperatorActivity(b.operatorId, activityOfB.id)

    const tourist = await db.user.create({
      data: {
        email: `${TEST_PREFIX}tourist-${Date.now()}@example.test`,
        name: 'Touriste',
      },
    })
    await createBookings({
      userId: tourist.id,
      lines: [{ slotId: withSlot.slots[0].id, participants: 2 }],
      contactPhone: '+230 5000 0000',
    })

    expect((await listOperatorBookings(b.operatorId, 1)).total).toBe(1)
    // Le point qui compte : A ne doit rien voir.
    expect((await listOperatorBookings(a.operatorId, 1)).total).toBe(0)
  })

  it('A ne peut pas supprimer un créneau de B', async () => {
    const a = await makeOperator('a')
    const b = await makeOperator('b')

    const activityOfB = await createActivity(b.operatorId, activityInput())
    const withSlots = await createSlots(b.operatorId, activityOfB.id, [
      { date: tomorrow(), time: '10:00', maxSpots: 5 },
    ])

    await expect(
      deleteSlot(a.operatorId, withSlots.slots[0].id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // Et le créneau est toujours là.
    expect(
      await db.activitySlot.count({ where: { id: withSlots.slots[0].id } }),
    ).toBe(1)
  })
})

describe('cycle de vie des activités', () => {
  it('crée toujours en brouillon, jamais en ligne', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())

    // Le statut n'est pas dans l'input du schéma : aucune requête client ne
    // peut publier directement.
    expect(created.status).toBe('draft')
  })

  it('refuse la soumission tant qu\'aucun créneau n\'existe', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())

    await expect(
      submitForModeration(a.operatorId, created.id),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await createSlots(a.operatorId, created.id, [
      { date: tomorrow(), time: '08:00', maxSpots: 4 },
    ])

    const submitted = await submitForModeration(a.operatorId, created.id)
    expect(submitted.status).toBe('pending_moderation')
  })

  it('renvoie en modération une activité publiée que l\'on modifie', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())
    await db.activity.update({
      where: { id: created.id },
      data: { status: 'published' },
    })

    const updated = await updateActivity(
      a.operatorId,
      created.id,
      activityInput({ title: `${TEST_PREFIX}titre remplacé` }),
    )

    // Sans cette règle, on ferait valider un texte anodin puis on le
    // remplacerait une fois en ligne.
    expect(updated.status).toBe('pending_moderation')
  })

  it('archive au lieu de supprimer, et sort du catalogue public', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())
    await db.activity.update({
      where: { id: created.id },
      data: { status: 'published' },
    })

    const before = await listActivities({ page: 1 })
    expect(before.activities.some((x) => x.id === created.id)).toBe(true)

    await archiveActivity(a.operatorId, created.id)

    // La ligne existe toujours — les réservations passées y pointent.
    const row = await db.activity.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.status).toBe('archived')

    const after = await listActivities({ page: 1 })
    expect(after.activities.some((x) => x.id === created.id)).toBe(false)
  })

  it('donne des slugs distincts à deux activités de même titre', async () => {
    const a = await makeOperator('a')
    const title = `${TEST_PREFIX}meme titre exact`

    const first = await createActivity(a.operatorId, activityInput({ title }))
    const second = await createActivity(a.operatorId, activityInput({ title }))

    expect(first.slug).not.toBe(second.slug)
  })
})

describe('créneaux', () => {
  it('interprète l\'heure saisie comme mauricienne (UTC+4)', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())
    const date = tomorrow()

    await createSlots(a.operatorId, created.id, [
      { date, time: '09:00', maxSpots: 8 },
    ])

    const slot = await db.activitySlot.findFirstOrThrow({
      where: { activityId: created.id },
    })

    // 09:00 à Maurice = 05:00 UTC. Si le serveur avait pris l'heure du poste,
    // ce départ tomberait ailleurs — sans lever la moindre erreur.
    expect(slot.startsAt.toISOString()).toBe(`${date}T05:00:00.000Z`)

    // Et le retour au format d'affichage redonne bien 09:00.
    const detail = await getOperatorActivity(a.operatorId, created.id)
    expect(detail.slots[0].time).toBe('09:00')
    expect(detail.slots[0].date).toBe(date)
  })

  it('refuse de supprimer un créneau déjà réservé', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())
    await db.activity.update({
      where: { id: created.id },
      data: { status: 'published' },
    })
    const withSlot = await createSlots(a.operatorId, created.id, [
      { date: tomorrow(), time: '11:00', maxSpots: 3 },
    ])
    const slotId = withSlot.slots[0].id

    const tourist = await db.user.create({
      data: {
        email: `${TEST_PREFIX}tourist2-${Date.now()}@example.test`,
        name: 'Touriste',
      },
    })
    await createBookings({
      userId: tourist.id,
      lines: [{ slotId, participants: 1 }],
      contactPhone: '+230 5000 0000',
    })

    // `slots → bookings` est en RESTRICT : sans ce garde, l'opérateur verrait
    // une erreur de contrainte illisible.
    await expect(deleteSlot(a.operatorId, slotId)).rejects.toMatchObject({
      code: 'CONFLICT',
    })

    const detail = await getOperatorActivity(a.operatorId, created.id)
    expect(detail.slots[0].deletable).toBe(false)
  })

  it('ignore les doublons quand un planning recouvre l\'existant', async () => {
    const a = await makeOperator('a')
    const created = await createActivity(a.operatorId, activityInput())
    const date = tomorrow()

    await createSlots(a.operatorId, created.id, [
      { date, time: '09:00', maxSpots: 5 },
    ])
    const after = await createSlots(a.operatorId, created.id, [
      { date, time: '09:00', maxSpots: 5 },
      { date, time: '14:00', maxSpots: 5 },
    ])

    expect(after.slots).toHaveLength(2)
  })
})

describe('demande d\'accès opérateur', () => {
  it('ne promeut PAS son appelant', async () => {
    const user = await db.user.create({
      data: {
        email: `${TEST_PREFIX}candidate-${Date.now()}@example.test`,
        name: 'Candidat',
      },
    })

    const profile = await requestOperatorAccess(user.id, 'Ma Société')

    expect(profile.verified).toBe(false)
    // LE point : le rôle reste `tourist`. Si cette procédure promouvait, elle
    // serait un endpoint d'auto-promotion.
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.role).toBe('tourist')
  })

  it('refuse une seconde demande pour le même compte', async () => {
    const user = await db.user.create({
      data: {
        email: `${TEST_PREFIX}candidate2-${Date.now()}@example.test`,
        name: 'Candidat',
      },
    })

    await requestOperatorAccess(user.id, 'Ma Société')
    await expect(
      requestOperatorAccess(user.id, 'Autre nom'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

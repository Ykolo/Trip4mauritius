import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  approveOperator,
  listActivitiesForModeration,
  publishActivity,
  rejectActivity,
  revokeOperator,
} from '@/server/services/admin'
import { listActivities } from '@/server/services/activity'
import {
  createActivity,
  createSlots,
  requestOperatorAccess,
  submitForModeration,
} from '@/server/services/operator'
import type { ActivityInput } from '@/lib/schemas/operator'
import { testCategoryId } from '@/server/services/test-support'

const TEST_PREFIX = 'vitest-admin-'

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

async function makeCandidate(label: string) {
  return db.user.create({
    data: {
      email: `${TEST_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`,
      name: `Candidat ${label}`,
    },
  })
}

async function activityInput(
  overrides: Partial<ActivityInput> = {},
): Promise<ActivityInput> {
  return {
    title: `${TEST_PREFIX}offre ${Math.random().toString(36).slice(2, 8)}`,
    categoryId: await testCategoryId(),
    region: 'South',
    duration: '3 hours',
    description: { fr: 'Description de test.' },
    priceHT: 60,
    maxParticipants: 8,
    languages: ['FR'],
    imageUrls: ['/images/hero.jpg'],
    included: [],
    excluded: [],
    ...overrides,
  }
}

function tomorrow(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Opérateur validé, avec une activité soumise à la modération. */
async function operatorWithSubmission() {
  const user = await makeCandidate('op')
  const profile = await requestOperatorAccess(user.id, 'Société de test')
  await approveOperator(profile.id)

  const activity = await createActivity(profile.id, await activityInput())
  await createSlots(profile.id, activity.id, [
    { date: tomorrow(), time: '09:00', maxSpots: 6 },
  ])
  await submitForModeration(profile.id, activity.id)

  return { userId: user.id, operatorId: profile.id, activityId: activity.id }
}

beforeEach(cleanup)
afterAll(cleanup)

describe('validation des opérateurs', () => {
  it('est le seul chemin vers le rôle opérateur', async () => {
    const user = await makeCandidate('a')
    const profile = await requestOperatorAccess(user.id, 'Ma Société')

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
    ).toBe('tourist')

    await approveOperator(profile.id)

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.role).toBe('operator')
    expect(
      (await db.operator.findUniqueOrThrow({ where: { id: profile.id } }))
        .verified,
    ).toBe(true)
  })

  it('ne fabrique JAMAIS d\'administrateur', async () => {
    const user = await makeCandidate('b')
    const profile = await requestOperatorAccess(user.id, 'Ma Société')
    await approveOperator(profile.id)

    // Aucun service de ce lot ne doit pouvoir hisser un compte au rang d'admin :
    // le premier admin vient du seed, et il n'existe pas de second chemin.
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.role).not.toBe('admin')
  })

  it('révoque : rétrograde, dévérifie et archive les activités en ligne', async () => {
    const { operatorId, userId, activityId } = await operatorWithSubmission()
    await publishActivity(activityId)

    const before = await listActivities({ page: 1 })
    expect(before.activities.some((a) => a.id === activityId)).toBe(true)

    await revokeOperator(operatorId)

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } })).role,
    ).toBe('tourist')
    expect(
      (await db.operator.findUniqueOrThrow({ where: { id: operatorId } }))
        .verified,
    ).toBe(false)

    // Laisser les fiches en ligne viderait la révocation de son sens.
    const activity = await db.activity.findUniqueOrThrow({
      where: { id: activityId },
    })
    expect(activity.status).toBe('archived')

    const after = await listActivities({ page: 1 })
    expect(after.activities.some((a) => a.id === activityId)).toBe(false)
  })

  it('refuse de révoquer un administrateur', async () => {
    const user = await makeCandidate('admin')
    const profile = await requestOperatorAccess(user.id, 'Admin Société')
    await db.user.update({ where: { id: user.id }, data: { role: 'admin' } })

    await expect(revokeOperator(profile.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
    ).toBe('admin')
  })
})

describe('modération des activités', () => {
  it('publie une activité soumise et la fait apparaître au catalogue', async () => {
    const { activityId } = await operatorWithSubmission()

    const queue = await listActivitiesForModeration('pending_moderation')
    expect(queue.some((a) => a.id === activityId)).toBe(true)

    await publishActivity(activityId)

    const listed = await listActivities({ page: 1 })
    expect(listed.activities.some((a) => a.id === activityId)).toBe(true)
  })

  it('refuse de publier une activité sans créneau à venir', async () => {
    const { operatorId, activityId } = await operatorWithSubmission()

    // On vide le planning : la fiche serait indexée mais irréservable.
    await db.activitySlot.deleteMany({ where: { activityId } })

    await expect(publishActivity(activityId)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    expect(
      (await db.activity.findUniqueOrThrow({ where: { id: activityId } }))
        .status,
    ).toBe('pending_moderation')

    // Et l'opérateur est bien celui qui possède l'activité — garde-fou du test.
    expect(
      await db.activity.count({ where: { id: activityId, operatorId } }),
    ).toBe(1)
  })

  it('résiste à deux administrateurs qui traitent la même activité', async () => {
    const { activityId } = await operatorWithSubmission()

    const results = await Promise.allSettled([
      publishActivity(activityId),
      rejectActivity(activityId),
    ])

    // Un seul verdict s'applique : sans la transition conditionnée sur le
    // statut lu, le second écraserait la décision du premier.
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)

    const final = await db.activity.findUniqueOrThrow({
      where: { id: activityId },
    })
    expect(['published', 'rejected']).toContain(final.status)
  })

  it('dépublie une activité en ligne et la sort du catalogue', async () => {
    const { activityId } = await operatorWithSubmission()
    await publishActivity(activityId)

    await rejectActivity(activityId)

    const listed = await listActivities({ page: 1 })
    expect(listed.activities.some((a) => a.id === activityId)).toBe(false)
  })

  it('ne laisse pas les brouillons entrer dans une file de modération', async () => {
    const user = await makeCandidate('draft')
    const profile = await requestOperatorAccess(user.id, 'Brouillonneur')
    await approveOperator(profile.id)
    const draft = await createActivity(profile.id, await activityInput())

    // Un brouillon appartient à son opérateur tant qu'il ne l'a pas soumis :
    // il ne doit apparaître dans aucune des files que l'admin peut ouvrir.
    for (const status of ['pending_moderation', 'published', 'rejected'] as const) {
      const queue = await listActivitiesForModeration(status)
      expect(queue.some((a) => a.id === draft.id)).toBe(false)
    }
  })
})

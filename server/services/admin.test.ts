import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createOperator } from '@/server/services/admin'
import { listActivities } from '@/server/services/activity'
import {
  createActivity,
  createSlots,
  publishOwnActivity,
} from '@/server/services/operator'
import type { ActivityInput } from '@/lib/schemas/operator'
import { testCategoryId } from '@/server/services/test-support'

// Lot 1 : plus de modération, plus d'auto-inscription.
//
// Ce qui était vérifié ici — file d'attente, validation, révocation — n'existe
// plus. Ce qui reste à prouver est plus étroit mais tout aussi sensible :
// `createOperator` est désormais le SEUL chemin vers le rôle `operator`, et il
// ne doit jamais devenir une fabrique d'administrateurs.

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

function testEmail(label: string) {
  return `${TEST_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
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

beforeEach(cleanup)
afterAll(cleanup)

describe('création d\'un opérateur', () => {
  it('est le seul chemin vers le rôle opérateur', async () => {
    const email = testEmail('neuf')
    const { operatorId, userCreated } = await createOperator({
      email,
      name: 'Contact Neuf',
      displayName: 'Société Neuve',
    })

    expect(userCreated).toBe(true)

    const user = await db.user.findUnique({
      where: { email },
      include: { operator: true },
    })
    expect(user?.role).toBe('operator')
    expect(user?.operator?.id).toBe(operatorId)
  })

  it('crée un compte SANS mot de passe', async () => {
    // Fabriquer un mot de passe ici obligerait à le transmettre en clair. Le
    // titulaire passe par « mot de passe oublié » — encore faut-il qu'aucune
    // ligne `account` ne soit écrite, sinon la connexion serait possible avec
    // une valeur que personne n'a choisie.
    const email = testEmail('sans-mdp')
    await createOperator({
      email,
      name: 'Contact',
      displayName: 'Sans Mot De Passe',
    })

    const user = await db.user.findUnique({
      where: { email },
      include: { accounts: true },
    })
    expect(user?.accounts).toHaveLength(0)
  })

  it('promeut un compte existant sans écraser ses données', async () => {
    const email = testEmail('touriste')
    const existing = await db.user.create({
      data: { email, name: 'Touriste Fidèle', role: 'tourist' },
    })

    const { userCreated } = await createOperator({
      email,
      name: 'Nom Ignoré',
      displayName: 'Sa Société',
    })

    expect(userCreated).toBe(false)

    const after = await db.user.findUnique({ where: { id: existing.id } })
    expect(after?.role).toBe('operator')
    // Le nom du compte appartient à son titulaire : la création d'opérateur
    // renseigne un nom commercial, elle ne réécrit pas l'identité.
    expect(after?.name).toBe('Touriste Fidèle')
  })

  it('ne fabrique JAMAIS d\'administrateur et n\'en rétrograde aucun', async () => {
    const email = testEmail('admin')
    const admin = await db.user.create({
      data: { email, name: 'Admin', role: 'admin' },
    })

    await createOperator({
      email,
      name: 'Admin',
      displayName: 'Société de l\'admin',
    })

    const after = await db.user.findUnique({ where: { id: admin.id } })
    // Ni promu au-dessus, ni rétrogradé en dessous.
    expect(after?.role).toBe('admin')
  })

  it('refuse un compte déjà opérateur', async () => {
    const email = testEmail('doublon')
    await createOperator({
      email,
      name: 'Contact',
      displayName: 'Première Société',
    })

    await expect(
      createOperator({
        email,
        name: 'Contact',
        displayName: 'Deuxième Société',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('mise en ligne sans modération', () => {
  async function operatorWithDraft() {
    const { operatorId } = await createOperator({
      email: testEmail('op'),
      name: 'Contact',
      displayName: 'Société de test',
    })

    const activity = await createActivity(operatorId, await activityInput())
    return { operatorId, activityId: activity.id }
  }

  it('publie directement, sans passer par une file d\'attente', async () => {
    const { operatorId, activityId } = await operatorWithDraft()
    await createSlots(operatorId, activityId, [
      { date: tomorrow(), time: '09:00', maxSpots: 6 },
    ])

    const result = await publishOwnActivity(operatorId, activityId)

    // C'est le cœur du lot 1 : plus d'état intermédiaire.
    expect(result.status).toBe('published')

    const { activities } = await listActivities({ page: 1 })
    expect(activities.some((a) => a.id === activityId)).toBe(true)
  })

  it('refuse de mettre en ligne une activité sans créneau à venir', async () => {
    // Le seul contrôle qui survit à la suppression de la modération : une fiche
    // publiée sans départ est indexée par les moteurs et réservable par
    // personne.
    const { operatorId, activityId } = await operatorWithDraft()

    await expect(
      publishOwnActivity(operatorId, activityId),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const { activities } = await listActivities({ page: 1 })
    expect(activities.some((a) => a.id === activityId)).toBe(false)
  })

  it('ne remet pas en ligne une activité déjà publiée', async () => {
    const { operatorId, activityId } = await operatorWithDraft()
    await createSlots(operatorId, activityId, [
      { date: tomorrow(), time: '09:00', maxSpots: 6 },
    ])
    await publishOwnActivity(operatorId, activityId)

    await expect(
      publishOwnActivity(operatorId, activityId),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

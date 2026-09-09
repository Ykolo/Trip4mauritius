import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  createActivityForAdmin,
  deleteSlotForAdmin,
  listActivitiesForAdmin,
  setActivityStatusForAdmin,
  updateActivityForAdmin,
} from '@/server/services/admin-catalog'
import { createBookings } from '@/server/services/booking'
import { updateActivity as updateActivityAsOperator } from '@/server/services/operator'
import { testCategoryId } from '@/server/services/test-support'
import { createCaller } from '@/server/trpc/root'
import { FEATURE_DEFAULTS } from '@/lib/features'
import type { ActivityInput } from '@/lib/schemas/operator'

// Gestion du catalogue par l'admin.
//
// Ce que ces tests protègent, c'est l'écart avec l'espace opérateur — pas le
// CRUD lui-même, déjà couvert par `operator.test.ts`. Trois différences sont
// intentionnelles et se casseraient en silence : l'absence de filtre par
// opérateur, l'absence de retour en modération à l'édition, et la garde sur les
// créneaux avant mise en ligne.

const TEST_PREFIX = 'vitest-catalog-'

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

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

async function makeOperator(label: string) {
  const user = await db.user.create({
    data: {
      email: `${TEST_PREFIX}${label}-${stamp()}@example.test`,
      name: `Compte ${label}`,
      role: 'operator',
    },
  })

  return db.operator.create({
    data: { userId: user.id, displayName: `Enseigne ${label}`, verified: true },
  })
}

async function activityInput(
  overrides: Partial<ActivityInput> = {},
): Promise<ActivityInput> {
  return {
    // Le slug est dérivé du titre : ce préfixe est ce que `cleanup` ramasse.
    title: `${TEST_PREFIX}sortie ${stamp()}`,
    categoryId: await testCategoryId(),
    region: 'North',
    duration: '< 2h',
    bookingMode: 'slot' as const,
    // Cohérent avec le libellé : `durationLabel` le DÉRIVE de cette valeur en
    // mode créneau, donc 90 doit bien redonner « < 2h ».
    durationMinutes: 90,
    description: { fr: 'Une sortie de test.' },
    priceHT: 120,
    maxParticipants: 12,
    languages: ['FR'],
    imageUrls: ['/images/test.jpg'],
    included: ['Guide'],
    excluded: [],
    ...overrides,
  }
}

/** Une fiche publiée avec un départ à venir — l'état le plus contraint. */
async function publishedActivity(operatorId: string) {
  const activity = await db.activity.create({
    data: {
      operatorId,
      categoryId: await testCategoryId(),
      slug: `${TEST_PREFIX}${stamp()}`,
      title: 'Sortie en ligne',
      region: 'West',
      duration: 'Demi-journée',
      durationMinutes: 240,
      priceHt: 90,
      maxParticipants: 10,
      status: 'published',
      description: { fr: 'x' },
    },
  })

  const slot = await db.activitySlot.create({
    data: {
      activityId: activity.id,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      maxSpots: 10,
    },
  })

  return { activity, slot }
}

describe('création', () => {
  it('crée un brouillon pour l’opérateur choisi', async () => {
    const operator = await makeOperator('a')
    const detail = await createActivityForAdmin(
      operator.id,
      await activityInput(),
    )

    expect(detail.status).toBe('draft')
    expect(detail.operatorId).toBe(operator.id)
    expect(detail.operatorName).toBe(operator.displayName)
  })

  it('refuse un opérateur inexistant avant de toucher à la base', async () => {
    // Sans cette garde, la clé étrangère remonterait une erreur Prisma
    // illisible pour l'admin.
    await expect(
      createActivityForAdmin('operateur-qui-nexiste-pas', await activityInput()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('édition', () => {
  it("ne renvoie PAS une fiche publiée en modération", async () => {
    // La correction d'une faute de frappe ne doit jamais sortir une fiche du
    // catalogue. C'était un écart assumé avec l'espace opérateur ; depuis la
    // suppression de la modération au lot 1, les deux services suivent la même
    // règle — voir le test suivant.
    const operator = await makeOperator('b')
    const { activity } = await publishedActivity(operator.id)

    const input = await activityInput()
    const detail = await updateActivityForAdmin(activity.id, {
      ...input,
      title: 'Titre corrigé',
    })

    expect(detail.status).toBe('published')
    expect(detail.title).toBe('Titre corrigé')
  })

  it("comme l'espace opérateur, qui ne l'en sort plus non plus", async () => {
    // Ce test vérifiait l'inverse : l'opérateur renvoyait sa fiche en
    // `pending_moderation`. Sans file d'attente, cette règle retirait la fiche
    // du catalogue sans que rien ne l'y ramène — l'opérateur se sabordait en
    // corrigeant son propre texte.
    const operator = await makeOperator('c')
    const { activity } = await publishedActivity(operator.id)

    const detail = await updateActivityAsOperator(
      operator.id,
      activity.id,
      await activityInput(),
    )

    expect(detail.status).toBe('published')
  })
})

describe('mise en ligne', () => {
  it('refuse une fiche sans départ à venir', async () => {
    const operator = await makeOperator('d')
    const draft = await createActivityForAdmin(
      operator.id,
      await activityInput(),
    )

    await expect(
      setActivityStatusForAdmin(draft.id, 'published'),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('accepte dès qu’un départ existe, et sait dépublier', async () => {
    const operator = await makeOperator('e')
    const draft = await createActivityForAdmin(
      operator.id,
      await activityInput(),
    )

    await db.activitySlot.create({
      data: {
        activityId: draft.id,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxSpots: 8,
      },
    })

    const online = await setActivityStatusForAdmin(draft.id, 'published')
    expect(online.status).toBe('published')

    // Dépublier renvoie en brouillon, jamais en « refusée » : refuser est un
    // verdict adressé à un opérateur.
    const back = await setActivityStatusForAdmin(draft.id, 'draft')
    expect(back.status).toBe('draft')
  })

  it('met en ligne une activité à la journée sans exiger de créneau', async () => {
    const operator = await makeOperator('e-daily')
    const draft = await createActivityForAdmin(
      operator.id,
      await activityInput({
        bookingMode: 'daily',
        duration: 'Journée',
        durationMinutes: undefined,
        dailyUnits: 3,
      }),
    )

    // La garde sur les créneaux est l'un des trois écarts que ce fichier
    // protège — encore faut-il qu'elle ne s'applique qu'au mode qui a des
    // créneaux. Passer par `setActivityStatusForAdmin`, et non par un
    // `status: 'published'` posé en base, est TOUT l'objet du test : c'est le
    // contournement qui avait masqué le blocage.
    const online = await setActivityStatusForAdmin(draft.id, 'published')
    expect(online.status).toBe('published')

    expect(
      await db.activitySlot.count({ where: { activityId: draft.id } }),
    ).toBe(0)
  })

  it('refuse une transition vers un état déjà atteint', async () => {
    const operator = await makeOperator('f')
    const { activity } = await publishedActivity(operator.id)

    await expect(
      setActivityStatusForAdmin(activity.id, 'published'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('listing', () => {
  it('voit les activités de TOUS les opérateurs', async () => {
    const first = await makeOperator('g')
    const second = await makeOperator('h')
    await publishedActivity(first.id)
    await publishedActivity(second.id)

    const page = await listActivitiesForAdmin({
      page: 1,
      status: 'all',
      search: TEST_PREFIX,
    })

    const owners = new Set(page.activities.map((a) => a.operatorId))
    expect(owners.has(first.id)).toBe(true)
    expect(owners.has(second.id)).toBe(true)
  })

  it('filtre par opérateur quand on le demande', async () => {
    const first = await makeOperator('i')
    const second = await makeOperator('j')
    await publishedActivity(first.id)
    await publishedActivity(second.id)

    const page = await listActivitiesForAdmin({
      page: 1,
      status: 'all',
      search: TEST_PREFIX,
      operatorId: first.id,
    })

    expect(page.activities.length).toBeGreaterThan(0)
    expect(page.activities.every((a) => a.operatorId === first.id)).toBe(true)
  })
})

describe('créneaux', () => {
  it('refuse de supprimer un créneau réservé', async () => {
    const operator = await makeOperator('k')
    const { slot } = await publishedActivity(operator.id)

    const tourist = await db.user.create({
      data: {
        email: `${TEST_PREFIX}tourist-${stamp()}@example.test`,
        name: 'Touriste',
      },
    })

    await createBookings({
      userId: tourist.id,
      lines: [{ mode: 'slot' as const, slotId: slot.id, participants: 2 }],
      contactPhone: '+23057000000',
    })

    // `slots → bookings` est en RESTRICT : sans ce refus explicite, l'admin
    // buterait sur une violation de clé étrangère.
    await expect(deleteSlotForAdmin(slot.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })
})

describe('cloisonnement', () => {
  // Ces procédures ÉCRIVENT le catalogue de n'importe quel opérateur. Une seule
  // laissée en `protectedProcedure` par distraction serait un droit d'édition
  // universel.
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
    'refuse les procédures de catalogue à un compte %s',
    async (role) => {
      const caller = callerAs(role)

      await expect(
        caller.admin.activities({ page: 1, status: 'all' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      await expect(caller.admin.operatorOptions()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })

      await expect(
        caller.admin.setActivityStatus({
          activityId: 'peu-importe',
          status: 'published',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    },
  )
})

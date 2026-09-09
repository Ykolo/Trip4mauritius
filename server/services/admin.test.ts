import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  createOperator,
  deleteOperator,
  listOperators,
  setOperatorActive,
  updateOperator,
} from '@/server/services/admin'
import { listOperatorOptions } from '@/server/services/admin-catalog'
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
//
// S'y ajoute le retrait d'un opérateur, qui a DEUX formes qu'il ne faut pas
// confondre : la suppression franche, réservée à celui qui n'a jamais rien
// vendu, et la désactivation, seule possible dès qu'une réservation existe.
// C'est `slots → bookings` (RESTRICT) qui impose la distinction — et une
// suppression qui passerait outre effacerait l'historique de touristes qui
// n'ont rien demandé.

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
    duration: 'Demi-journée',
    bookingMode: 'slot' as const,
    durationMinutes: 240,
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

/** Opérateur + une activité en brouillon, le décor minimal de ces tests. */
async function operatorWithActivity(label = 'op') {
  const email = testEmail(label)
  const { operatorId } = await createOperator({
    email,
    name: 'Contact',
    displayName: 'Société de test',
  })
  const activity = await createActivity(operatorId, await activityInput())
  return { operatorId, email, activityId: activity.id }
}

/**
 * Pose une réservation sur une activité, en écrivant directement en base.
 *
 * On court-circuite `createBookings` volontairement : ce qui est testé ici
 * n'est pas le tunnel de réservation (il a son propre fichier) mais le fait
 * qu'une LIGNE dans `bookings` suffit à interdire la suppression. Les montants
 * respectent le CHECK `depositDue + balanceDueOnSite = totalPrice`.
 */
async function bookingOn(activityId: string) {
  const slot = await db.activitySlot.create({
    data: {
      activityId,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      maxSpots: 4,
    },
  })

  const tourist = await db.user.create({
    data: { email: testEmail('client'), name: 'Client', role: 'tourist' },
  })

  return db.booking.create({
    data: {
      bookingRef: `${TEST_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: tourist.id,
      activityId,
      slotId: slot.id,
      // Recopié du créneau, comme le fait `createBookings` : c'est
      // `bookings_mode_shape` qui refuserait une ligne sans période.
      startsAt: slot.startsAt,
      participants: 2,
      totalPrice: 100,
      depositDue: 20,
      balanceDueOnSite: 80,
    },
  })
}

async function roleOf(email: string) {
  const user = await db.user.findUnique({ where: { email } })
  return user?.role
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

  it.each(['admin', 'superadmin'] as const)(
    'ne rétrograde JAMAIS un compte %s',
    async (role) => {
      // Le seul rempart : sans la liste des rôles privilégiés, créer un profil
      // opérateur sur l'adresse du super admin lui retirerait les interrupteurs
      // en silence, sans qu'aucun écran ne le signale.
      const email = testEmail(role)
      const user = await db.user.create({
        data: { email, name: 'Privilégié', role },
      })

      await createOperator({
        email,
        name: 'Privilégié',
        displayName: `Société ${role}`,
      })

      const after = await db.user.findUnique({ where: { id: user.id } })
      expect(after?.role).toBe(role)
    },
  )

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
  const operatorWithDraft = operatorWithActivity

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

describe('édition d\'un opérateur', () => {
  it('écrit les DEUX tables et ne touche pas au rôle', async () => {
    // Nom commercial et coordonnées vivent sur `Operator`, identité réelle et
    // adresse de connexion sur `User`. Une écriture partielle laisserait un
    // opérateur renommé dont le compte porte encore l'ancienne adresse.
    const { operatorId, email } = await operatorWithActivity('edit')
    const nouveau = testEmail('edit-nouveau')

    await updateOperator({
      operatorId,
      displayName: 'Nouvelle Enseigne',
      name: 'Nouveau Contact',
      email: nouveau,
      whatsapp: '+230 5789 1234',
      avatarUrl: '/images/logo.png',
    })

    const operator = await db.operator.findUnique({
      where: { id: operatorId },
      include: { user: true },
    })

    expect(operator?.displayName).toBe('Nouvelle Enseigne')
    expect(operator?.whatsapp).toBe('+230 5789 1234')
    expect(operator?.avatarUrl).toBe('/images/logo.png')
    expect(operator?.user.name).toBe('Nouveau Contact')
    expect(operator?.user.email).toBe(nouveau)
    // Éditer une fiche n'est pas changer des droits.
    expect(operator?.user.role).toBe('operator')
    expect(await roleOf(email)).toBeUndefined()
  })

  it('normalise l\'adresse, quel que soit le chemin d\'appel', async () => {
    // Le service est consommé par les routers tRPC ET directement. S'en
    // remettre au `.toLowerCase()` de Zod laisserait entrer une majuscule par
    // un chemin et pas par l'autre — deux comptes pour une seule adresse.
    const { operatorId } = await operatorWithActivity('casse')
    const brut = testEmail('MaJuScUlE').toUpperCase()

    await updateOperator({
      operatorId,
      displayName: 'Enseigne',
      name: 'Contact',
      email: `  ${brut}  `,
    })

    const operator = await db.operator.findUnique({
      where: { id: operatorId },
      include: { user: true },
    })
    expect(operator?.user.email).toBe(brut.toLowerCase())
  })

  it('refuse une adresse déjà prise par un autre compte', async () => {
    const premier = await operatorWithActivity('premier')
    const second = await operatorWithActivity('second')

    await expect(
      updateOperator({
        operatorId: second.operatorId,
        displayName: 'Enseigne',
        name: 'Contact',
        email: premier.email,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    // Et rien n'a bougé : le refus est posé AVANT les deux écritures.
    const inchange = await db.operator.findUnique({
      where: { id: second.operatorId },
      include: { user: true },
    })
    expect(inchange?.user.email).toBe(second.email)
  })

  it('accepte de réenregistrer un opérateur sans changer son adresse', async () => {
    // La garde de collision doit s'exclure elle-même : sinon, corriger le seul
    // nom commercial serait refusé parce que l'adresse « appartient déjà » au
    // compte qu'on est en train d'éditer.
    const { operatorId, email } = await operatorWithActivity('idem')

    await updateOperator({
      operatorId,
      displayName: 'Enseigne Corrigée',
      name: 'Contact',
      email,
    })

    const operator = await db.operator.findUnique({ where: { id: operatorId } })
    expect(operator?.displayName).toBe('Enseigne Corrigée')
  })

  it('retire le numéro WhatsApp quand le champ est vidé', async () => {
    // Un numéro devenu faux doit pouvoir être effacé, sinon le bouton du
    // back-office composerait indéfiniment une ligne coupée.
    const { operatorId, email } = await operatorWithActivity('sans-num')
    await updateOperator({
      operatorId,
      displayName: 'Enseigne',
      name: 'Contact',
      email,
      whatsapp: '+230 5789 1234',
    })

    await updateOperator({
      operatorId,
      displayName: 'Enseigne',
      name: 'Contact',
      email,
      whatsapp: null,
    })

    const operator = await db.operator.findUnique({ where: { id: operatorId } })
    expect(operator?.whatsapp).toBeNull()
  })
})

describe('suppression d\'un opérateur', () => {
  it('supprime le profil et ses activités, mais CONSERVE le compte', async () => {
    // Le compte peut porter des réservations en tant que touriste
    // (`bookings → user` est en RESTRICT) : le supprimer pour retirer un rôle
    // serait hors de proportion.
    const { operatorId, email, activityId } = await operatorWithActivity('vierge')

    const { deletedActivities } = await deleteOperator({ operatorId })
    expect(deletedActivities).toBe(1)

    expect(await db.operator.findUnique({ where: { id: operatorId } })).toBeNull()
    expect(await db.activity.findUnique({ where: { id: activityId } })).toBeNull()
    expect(await roleOf(email)).toBe('tourist')
  })

  it('refuse dès qu\'une réservation existe, et ne touche à RIEN', async () => {
    const { operatorId, activityId } = await operatorWithActivity('vendu')
    await bookingOn(activityId)

    await expect(deleteOperator({ operatorId })).rejects.toMatchObject({
      code: 'CONFLICT',
    })

    // Le refus doit être total : une suppression partielle aurait emporté les
    // activités avant de buter sur la clé étrangère des réservations.
    expect(
      await db.operator.findUnique({ where: { id: operatorId } }),
    ).not.toBeNull()
    expect(
      await db.activity.findUnique({ where: { id: activityId } }),
    ).not.toBeNull()
  })

  it.each(['admin', 'superadmin'] as const)(
    'ne rétrograde JAMAIS un compte %s',
    async (role) => {
      const email = testEmail(`del-${role}`)
      await db.user.create({ data: { email, name: 'Privilégié', role } })
      const { operatorId } = await createOperator({
        email,
        name: 'Privilégié',
        displayName: `Société ${role}`,
      })

      await deleteOperator({ operatorId })

      expect(await roleOf(email)).toBe(role)
    },
  )
})

describe('désactivation d\'un opérateur', () => {
  it('archive les activités, rétrograde le compte et garde les réservations', async () => {
    const { operatorId, email, activityId } = await operatorWithActivity('desac')
    const booking = await bookingOn(activityId)

    const result = await setOperatorActive({ operatorId, active: false })
    expect(result.archivedActivities).toBe(1)

    const activity = await db.activity.findUnique({ where: { id: activityId } })
    expect(activity?.status).toBe('archived')
    expect(await roleOf(email)).toBe('tourist')

    // Ce qui distingue la désactivation de la suppression : l'historique
    // survit, et son titulaire peut toujours le consulter.
    expect(
      await db.booking.findUnique({ where: { id: booking.id } }),
    ).not.toBeNull()
  })

  it('réactive sans DÉSARCHIVER les activités', async () => {
    // Republier en masse ressusciterait des départs passés et des prix
    // périmés : l'admin rouvre chaque fiche en connaissance de cause.
    const { operatorId, email, activityId } = await operatorWithActivity('react')
    await setOperatorActive({ operatorId, active: false })

    await setOperatorActive({ operatorId, active: true })

    const operator = await db.operator.findUnique({ where: { id: operatorId } })
    expect(operator?.active).toBe(true)
    expect(await roleOf(email)).toBe('operator')

    const activity = await db.activity.findUnique({ where: { id: activityId } })
    expect(activity?.status).toBe('archived')
  })

  it('sort du sélecteur d\'opérateurs de la création de fiche', async () => {
    // Sinon on pourrait créer une fiche neuve chez un prestataire dont on vient
    // d'archiver tout le catalogue.
    const { operatorId } = await operatorWithActivity('selecteur')
    expect(
      (await listOperatorOptions()).some((o) => o.id === operatorId),
    ).toBe(true)

    await setOperatorActive({ operatorId, active: false })

    expect(
      (await listOperatorOptions()).some((o) => o.id === operatorId),
    ).toBe(false)
  })

  it.each(['admin', 'superadmin'] as const)(
    'ne rétrograde JAMAIS un compte %s',
    async (role) => {
      const email = testEmail(`desac-${role}`)
      await db.user.create({ data: { email, name: 'Privilégié', role } })
      const { operatorId } = await createOperator({
        email,
        name: 'Privilégié',
        displayName: `Société ${role}`,
      })

      await setOperatorActive({ operatorId, active: false })

      expect(await roleOf(email)).toBe(role)
    },
  )
})

describe('listing des opérateurs', () => {
  it('expose le nombre de réservations et en dérive la suppressibilité', async () => {
    // `deletable` est dérivé CÔTÉ SERVEUR : l'écran qui reconstituerait la
    // règle finirait par proposer un bouton que la procédure rejette.
    const vierge = await operatorWithActivity('listing-vierge')
    const vendu = await operatorWithActivity('listing-vendu')
    await bookingOn(vendu.activityId)

    const rows = await listOperators()
    const a = rows.find((r) => r.operatorId === vierge.operatorId)
    const b = rows.find((r) => r.operatorId === vendu.operatorId)

    expect(a?.bookingCount).toBe(0)
    expect(a?.deletable).toBe(true)
    expect(b?.bookingCount).toBe(1)
    expect(b?.deletable).toBe(false)
    expect(b?.active).toBe(true)
  })
})

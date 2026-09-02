import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  createCategory,
  listActiveCategories,
  listCategoriesForAdmin,
  setCategoryActive,
  slugify,
  updateCategory,
} from '@/server/services/category'
import { listActivities } from '@/server/services/activity'

const TEST_PREFIX = 'Vitest Cat '

async function cleanup() {
  await db.category.deleteMany({ where: { label: { startsWith: TEST_PREFIX } } })
}

beforeEach(cleanup)
afterEach(cleanup)

describe('slugify', () => {
  it('déplie les accents au lieu de les supprimer', () => {
    // « Bien-être » → `bien-tre` rendrait l'adresse illisible et instable.
    expect(slugify('Bien-être')).toBe('bien-etre')
    expect(slugify('Croisières')).toBe('croisieres')
    expect(slugify('Véhicules')).toBe('vehicules')
  })

  it('réduit ponctuation et espaces à un seul tiret', () => {
    expect(slugify('Food & Drink')).toBe('food-drink')
    expect(slugify('  Sports   nautiques  ')).toBe('sports-nautiques')
  })
})

describe('création', () => {
  it('dérive le slug et place la nouvelle catégorie en fin de liste', async () => {
    const before = await listCategoriesForAdmin()
    const maxPosition = Math.max(...before.map((c) => c.position))

    const created = await createCategory({
      label: `${TEST_PREFIX}Plongée`,
      emoji: '🤿',
    })

    expect(created.slug).toBe(slugify(`${TEST_PREFIX}Plongée`))
    // S'insérer en tête réordonnerait le catalogue de quelqu'un d'autre.
    expect(created.position).toBeGreaterThan(maxPosition)
  })

  it('refuse un doublon plutôt que de laisser deux entrées identiques', async () => {
    await createCategory({ label: `${TEST_PREFIX}Doublon` })

    await expect(
      createCategory({ label: `${TEST_PREFIX}Doublon` }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it("oriente vers la réactivation quand le doublon est une catégorie masquée", async () => {
    const created = await createCategory({ label: `${TEST_PREFIX}Masquée` })
    await setCategoryActive(created.id, false)

    // Sans ce message, l'admin ne comprendrait pas pourquoi un libellé
    // « libre » est refusé : la catégorie existe mais n'est nulle part visible.
    await expect(
      createCategory({ label: `${TEST_PREFIX}Masquée` }),
    ).rejects.toMatchObject({ message: expect.stringContaining('désactivée') })
  })

  it("refuse un libellé qui ne produit aucune adresse", async () => {
    await expect(createCategory({ label: '!!!' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})

describe('renommage', () => {
  it('change le libellé mais JAMAIS le slug', async () => {
    // Le slug vit dans l'URL des recherches filtrées, partagées et indexées.
    // Le renommer viderait ces liens sans lever la moindre erreur.
    const created = await createCategory({ label: `${TEST_PREFIX}Avant` })

    const renamed = await updateCategory(created.id, {
      label: `${TEST_PREFIX}Après`,
    })

    expect(renamed.label).toBe(`${TEST_PREFIX}Après`)
    expect(renamed.slug).toBe(created.slug)
  })
})

describe('masquage', () => {
  it("retire la catégorie des listes publiques sans toucher aux activités", async () => {
    const created = await createCategory({ label: `${TEST_PREFIX}Temporaire` })

    expect((await listActiveCategories()).map((c) => c.id)).toContain(created.id)

    await setCategoryActive(created.id, false)

    expect((await listActiveCategories()).map((c) => c.id)).not.toContain(
      created.id,
    )
    // L'admin, lui, continue de la voir : sinon il ne pourrait plus la
    // réactiver.
    expect((await listCategoriesForAdmin()).map((c) => c.id)).toContain(
      created.id,
    )
  })
})

describe('filtrage du catalogue', () => {
  it('filtre sur le slug, et un slug inconnu ne renvoie rien', async () => {
    const all = await listActivities({ page: 1 })
    expect(all.total).toBeGreaterThan(0)

    const categories = await listActiveCategories()
    const used = categories.find((c) => c.slug === 'vehicules') ?? categories[0]

    const filtered = await listActivities({ page: 1, category: [used.slug] })
    expect(filtered.total).toBeGreaterThan(0)
    expect(filtered.total).toBeLessThanOrEqual(all.total)
    expect(filtered.activities.every((a) => a.categorySlug === used.slug)).toBe(
      true,
    )

    // C'était le bug d'origine : les vignettes de l'accueil pointaient sur des
    // slugs qu'aucune activité ne portait, et renvoyaient une page vide.
    const nonsense = await listActivities({ page: 1, category: ['diving'] })
    expect(nonsense.total).toBe(0)
  })

  it("expose le libellé pour l'affichage ET le slug pour le filtrage", async () => {
    const { activities } = await listActivities({ page: 1 })
    const activity = activities[0]

    expect(activity.category).toBeTruthy()
    expect(activity.categorySlug).toBeTruthy()
    // Les confondre est exactement ce qui a cassé le catalogue.
    expect(activity.categorySlug).toBe(slugify(activity.categorySlug))
  })
})

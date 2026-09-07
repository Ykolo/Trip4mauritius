import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  createGuide,
  createGuideCategory,
  getPublishedGuide,
  listPublishedGuides,
  renameGuideCategory,
  setGuideCategoryActive,
  updateGuide,
} from '@/server/services/guide'
import { FEATURE_DEFAULTS } from '@/lib/features'
import { createCaller } from '@/server/trpc/root'

// Les propriétés qui comptent sur les guides sont celles qui ont déjà cassé le
// catalogue une fois : le slug doit être immuable parce qu'il vit dans des URL
// partagées, et un brouillon ne doit JAMAIS sortir par la lecture publique.

const TEST_PREFIX = 'vitest-guide-'

async function cleanup() {
  await db.guide.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
  await db.guideCategory.deleteMany({
    where: { label: { startsWith: TEST_PREFIX } },
  })
}

/**
 * Libellé volontairement NON slug : accents, espaces, esperluette.
 *
 * Un libellé déjà identique à son slug rendrait le test du filtre vide de sens
 * — filtrer sur l'un ou l'autre donnerait le même résultat, et l'inversion des
 * deux passerait inaperçue. C'est exactement la confusion qui avait cassé le
 * catalogue d'activités.
 */
async function makeCategory(suffix: string) {
  return createGuideCategory(`${TEST_PREFIX}${suffix} Épices & Saveurs ${Date.now()}`)
}

function guideInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: `${TEST_PREFIX}securite routiere`,
    excerpt: 'Ce qu’il faut savoir avant de prendre le volant.',
    content: '## Rouler à gauche\n\nLe volant est à droite.',
    categoryId,
    imageUrls: [],
    status: 'draft' as const,
    ...overrides,
  }
}

beforeEach(cleanup)
afterAll(cleanup)

describe('classification', () => {
  it('dérive un slug du libellé et refuse le doublon', async () => {
    const category = await makeCategory('gastronomie')
    expect(category.slug).toMatch(/^vitest-guide-gastronomie-epices-saveurs/)
    // Le slug est normalisé, le libellé garde ses accents : les deux diffèrent.
    expect(category.slug).not.toBe(category.label)

    await expect(createGuideCategory(category.label)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('renomme le libellé SANS déplacer le slug', async () => {
    // Le slug vit dans /guide?categorie=… — des liens partagés et indexés. Le
    // renommer casserait la page en silence : elle s'afficherait vide.
    const category = await makeCategory('parking')
    await renameGuideCategory(category.id, `${TEST_PREFIX}Stationnement en ville`)

    const after = await db.guideCategory.findUniqueOrThrow({
      where: { id: category.id },
    })
    expect(after.label).toBe(`${TEST_PREFIX}Stationnement en ville`)
    expect(after.slug).toBe(category.slug)
  })

  it('désactive sans emporter les articles déjà classés', async () => {
    const category = await makeCategory('desactivable')
    const guide = await createGuide(
      guideInput(category.id, { status: 'published' }),
    )

    await setGuideCategoryActive(category.id, false)

    // L'article survit — la clé étrangère est en RESTRICT, on ne supprime pas.
    const still = await db.guide.findUnique({ where: { id: guide.id } })
    expect(still).not.toBeNull()
  })
})

describe('articles', () => {
  it('ne laisse PAS un brouillon sortir par la lecture publique', async () => {
    const category = await makeCategory('brouillon')
    const guide = await createGuide(guideInput(category.id))

    expect(await getPublishedGuide(guide.slug)).toBeNull()

    const listed = await listPublishedGuides()
    expect(listed.some((g) => g.slug === guide.slug)).toBe(false)
  })

  it('publie, puis filtre sur le SLUG de catégorie', async () => {
    const a = await makeCategory('cat-a')
    const b = await makeCategory('cat-b')

    const published = await createGuide(
      guideInput(a.id, { status: 'published' }),
    )
    await createGuide(
      guideInput(b.id, { title: `${TEST_PREFIX}autre`, status: 'published' }),
    )

    const inA = await listPublishedGuides(a.slug)
    expect(inA.map((g) => g.slug)).toEqual([published.slug])

    // Le libellé n'est PAS une clé de filtre : le passer ne doit rien renvoyer.
    expect(await listPublishedGuides(a.label)).toEqual([])
  })

  it('ne déplace pas le slug quand on corrige le titre', async () => {
    const category = await makeCategory('titre')
    const guide = await createGuide(guideInput(category.id))

    const updated = await updateGuide(
      guide.id,
      guideInput(category.id, { title: `${TEST_PREFIX}titre entierement refait` }),
    )

    expect(updated.title).toContain('entierement refait')
    expect(updated.slug).toBe(guide.slug)
  })

  it('numérote les slugs identiques au lieu d’échouer', async () => {
    const category = await makeCategory('collision')
    const first = await createGuide(guideInput(category.id))
    const second = await createGuide(guideInput(category.id))

    expect(second.slug).not.toBe(first.slug)
    expect(second.slug).toBe(`${first.slug}-2`)
  })

  it('refuse une catégorie inexistante avant de toucher à la base', async () => {
    await expect(
      createGuide(guideInput('categorie-qui-nexiste-pas')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('cloisonnement', () => {
  // L'écriture des guides expose les brouillons. Une procédure laissée en
  // `publicProcedure` par distraction les ouvrirait à tout le monde.
  it.each(['tourist', 'operator'] as const)(
    'refuse admin.guides à un compte %s',
    async (role) => {
      const caller = createCaller({
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

      await expect(caller.admin.guides()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    },
  )
})

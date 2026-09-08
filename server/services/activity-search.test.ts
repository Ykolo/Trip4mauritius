import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { activityFiltersSchema } from '@/lib/schemas/activity'
import {
  listActivities,
  suggestActivities,
  SUGGESTION_LIMIT,
} from '@/server/services/activity'
import { createCategory } from '@/server/services/category'

/**
 * Recherche par mot-clé et vocabulaire de filtrage.
 *
 * Le bug d'origine : la barre de recherche « renvoyait toujours tout ». Trois
 * causes empilées, chacune couverte ici.
 *
 * 1. `q` n'existait dans AUCUN schéma. Le formulaire de l'accueil l'émettait,
 *    Zod le supprimait, le service ne le lisait pas — et le catalogue rendait
 *    le catalogue complet quel que soit le mot-clé.
 * 2. Le tiroir de filtres proposait des régions FRANÇAISES là où la base stocke
 *    de l'ANGLAIS. Quatre régions sur cinq ne renvoyaient rien.
 * 3. Les durées existaient en deux vocabulaires concurrents en base.
 *
 * Comme les tests de catégories, ceux-ci construisent leurs propres données :
 * en CI, ils visent un Postgres jetable qui n'a que les migrations, pas les 22
 * activités de la branche `dev`.
 */

const TEST_PREFIX = 'Vitest Search '
const SLUG_PREFIX = 'vitest-search-'

async function cleanup() {
  await db.activity.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } })
  await db.operator.deleteMany({
    where: { user: { email: { startsWith: SLUG_PREFIX } } },
  })
  await db.user.deleteMany({ where: { email: { startsWith: SLUG_PREFIX } } })
  await db.category.deleteMany({ where: { label: { startsWith: TEST_PREFIX } } })
}

beforeEach(cleanup)
afterEach(cleanup)

async function publish(opts: {
  key: string
  title: string
  region?: string
  duration?: string
  categoryLabel?: string
}) {
  const category = await createCategory({
    label: `${TEST_PREFIX}${opts.categoryLabel ?? opts.key}`,
  })

  const user = await db.user.create({
    data: {
      email: `${SLUG_PREFIX}${opts.key}-${Date.now()}@example.test`,
      name: `Pro ${opts.key}`,
      role: 'operator',
    },
  })
  const operator = await db.operator.create({
    data: { userId: user.id, displayName: `Enseigne ${opts.key}` },
  })

  return db.activity.create({
    data: {
      operatorId: operator.id,
      categoryId: category.id,
      slug: `${SLUG_PREFIX}${opts.key}-${Date.now()}`,
      title: opts.title,
      region: opts.region ?? 'North',
      duration: opts.duration ?? '< 2h',
      priceHt: 50,
      maxParticipants: 10,
      status: 'published',
      description: { fr: 'x' },
    },
  })
}

describe('recherche par mot-clé', () => {
  it('ne renvoie que les activités dont le titre correspond', async () => {
    const wanted = await publish({ key: 'a', title: 'Sortie plongée au lagon' })
    const other = await publish({ key: 'b', title: 'Randonnée en montagne' })

    const found = await listActivities({ page: 1, q: 'plongée' })

    // Le cœur du bug : avant, ce total valait 2 — le catalogue entier.
    expect(found.activities.map((a) => a.slug)).toContain(wanted.slug)
    expect(found.activities.map((a) => a.slug)).not.toContain(other.slug)
  })

  it('ignore la casse', async () => {
    // Personne ne retape le titre avec ses majuscules d'origine.
    const a = await publish({ key: 'casse', title: 'Catamaran vers Ile aux Cerfs' })

    const found = await listActivities({ page: 1, q: 'CATAMARAN' })
    expect(found.activities.map((s) => s.slug)).toContain(a.slug)
  })

  it('trouve aussi par région et par libellé de catégorie', async () => {
    const a = await publish({
      key: 'kite',
      title: 'Baptême de cerf-volant tracté',
      region: 'East',
      categoryLabel: 'Kitesurf',
    })

    // Chercher « Kitesurf » doit sortir l'activité, alors que le mot n'est
    // nulle part dans son titre.
    const byCategory = await listActivities({ page: 1, q: 'kitesurf' })
    expect(byCategory.activities.map((s) => s.slug)).toContain(a.slug)

    const byRegion = await listActivities({ page: 1, q: 'East' })
    expect(byRegion.activities.map((s) => s.slug)).toContain(a.slug)
  })

  it('un mot-clé sans correspondance ne renvoie rien', async () => {
    await publish({ key: 'vide', title: 'Sortie en mer' })

    // Un catalogue complet en réponse à une recherche infructueuse est
    // exactement ce que l'utilisateur a signalé.
    const found = await listActivities({ page: 1, q: 'zzzzz-introuvable' })
    expect(found.total).toBe(0)
  })
})

describe('suggestions de la barre de recherche', () => {
  it('propose des activités même sans mot-clé', async () => {
    await publish({ key: 'sugg', title: 'Sortie test suggestions' })

    // Ouvrir la barre sur une liste vide n'apprend rien au visiteur : ni ce
    // qu'il peut chercher, ni que la recherche existe.
    const suggestions = await suggestActivities()
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.length).toBeLessThanOrEqual(SUGGESTION_LIMIT)
  })

  it('applique le même prédicat que la page de résultats', async () => {
    const a = await publish({ key: 'meme', title: 'Kayak au clair de lune' })

    const suggested = await suggestActivities('clair de lune')
    const listed = await listActivities({ page: 1, q: 'clair de lune' })

    // Suggérer une activité que la page de résultats n'afficherait pas est le
    // pire des deux mondes : on promet puis on ne trouve rien.
    expect(suggested.map((s) => s.slug)).toContain(a.slug)
    expect(listed.activities.map((s) => s.slug)).toContain(a.slug)
  })

  it('renvoie une liste vide quand rien ne correspond', async () => {
    await publish({ key: 'rien', title: 'Sortie ordinaire' })

    // C'est cette liste vide qui déclenche le « Aucune activité pour … »
    // affiché sous le champ.
    expect(await suggestActivities('zzzzz-introuvable')).toEqual([])
  })

  it('ne suggère jamais une activité non publiée', async () => {
    const draft = await publish({ key: 'brouillon', title: 'Brouillon secret' })
    await db.activity.update({
      where: { id: draft.id },
      data: { status: 'draft' },
    })

    // Une suggestion est du contenu public : un brouillon qui y remonterait
    // fuiterait par une porte que le catalogue tient pourtant fermée.
    const suggestions = await suggestActivities('Brouillon secret')
    expect(suggestions).toEqual([])
  })

  it('expose le libellé de catégorie, pas le slug', async () => {
    const a = await publish({
      key: 'libelle',
      title: 'Sortie libellé',
      categoryLabel: 'Plongée',
    })

    const [suggestion] = await suggestActivities('Sortie libellé')
    expect(suggestion.slug).toBe(a.slug)
    // Le front AFFICHE le libellé. Y renvoyer le slug écrirait
    // « vitest-cat-plongee » sous le titre.
    expect(suggestion.category).toBe(`${TEST_PREFIX}Plongée`)
  })
})

describe('normalisation des paramètres d’URL', () => {
  it('traite un mot-clé vide ou blanc comme une absence de filtre', () => {
    // `?q=` et `?q=%20` ne doivent pas produire trois listes différentes.
    expect(activityFiltersSchema.parse({ q: '' }).q).toBeUndefined()
    expect(activityFiltersSchema.parse({ q: '   ' }).q).toBeUndefined()
    expect(activityFiltersSchema.parse({ q: '  lagon ' }).q).toBe('lagon')
  })

  it('écarte une durée hors de la liste fermée au lieu de vider la page', () => {
    // La sentinelle du tiroir de filtres : `?duration=Toutes` filtrait sur la
    // chaîne « Toutes », qu'aucune activité ne porte, et rendait page blanche.
    expect(activityFiltersSchema.parse({ duration: 'Toutes' }).duration).toBeUndefined()
    // Idem pour une valeur périmée dormant dans un lien déjà partagé.
    expect(activityFiltersSchema.parse({ duration: 'Full day' }).duration).toBeUndefined()

    expect(activityFiltersSchema.parse({ duration: 'Journée' }).duration).toBe('Journée')
  })
})

describe('vocabulaire des régions', () => {
  it('filtre sur la valeur stockée, pas sur le libellé français', async () => {
    const nord = await publish({ key: 'nord', title: 'Grand Baie', region: 'North' })

    const stored = await listActivities({ page: 1, region: ['North'] })
    expect(stored.activities.map((a) => a.slug)).toContain(nord.slug)

    // C'est ce que le tiroir de filtres envoyait : le libellé affiché. Aucune
    // activité ne porte « Nord » en base, donc zéro résultat — le filtre
    // paraissait cassé alors qu'il faisait exactement ce qu'on lui demandait.
    const label = await listActivities({ page: 1, region: ['Nord'] })
    expect(label.total).toBe(0)
  })
})

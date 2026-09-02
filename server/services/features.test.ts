import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  FEATURES,
  FEATURE_DEFAULTS,
  FEATURE_KEYS,
  featureEnvVar,
  isFeatureKey,
} from '@/lib/features'
import {
  getFeatures,
  invalidateFeatureCache,
  listFeatureFlags,
  resetFeatureFlag,
  setFeatureFlag,
} from '@/server/services/features'
import { createCaller } from '@/server/trpc/root'

// Le flag testé est un vrai flag du registre : un flag inventé pour les tests
// ne prouverait que le fonctionnement du flag inventé.
const KEY = 'operator.selfSignup' as const
const ENV_VAR = featureEnvVar(KEY)

async function clean() {
  await db.featureFlag.deleteMany({ where: { key: { in: FEATURE_KEYS } } })
  delete process.env[ENV_VAR]
  invalidateFeatureCache()
}

beforeEach(clean)
afterEach(clean)

describe('registre', () => {
  it("n'a pas de flag périmé", () => {
    // Ce test échoue au passage de la date, sans qu'aucun code n'ait changé.
    // C'est le but : un flag qui survit à son échéance oblige à maintenir deux
    // chemins pour toujours. Soit on le retire, soit on repousse la date — mais
    // jamais par oubli.
    const today = new Date().toISOString().slice(0, 10)
    const expired = FEATURE_KEYS.filter((k) => FEATURES[k].expiresOn < today)

    expect(
      expired,
      `Flags à retirer du code (échéance dépassée) : ${expired.join(', ')}`,
    ).toEqual([])
  })

  it('nomme les variables d\'environnement sans collision', () => {
    const names = FEATURE_KEYS.map(featureEnvVar)
    expect(new Set(names).size).toBe(names.length)
    expect(featureEnvVar('operator.selfSignup')).toBe(
      'FEATURE_OPERATOR_SELF_SIGNUP',
    )
  })

  it('ne reconnaît pas une clé absente du registre', () => {
    expect(isFeatureKey('operator.selfSignup')).toBe(true)
    expect(isFeatureKey('flag.inexistant')).toBe(false)
    // Un flag ne doit pas pouvoir naître d'une propriété héritée d'Object.
    expect(isFeatureKey('toString')).toBe(false)
  })
})

describe('cascade défaut ← environnement ← base', () => {
  it('retombe sur le défaut du code quand personne ne se prononce', async () => {
    await expect(getFeatures()).resolves.toMatchObject({
      [KEY]: FEATURE_DEFAULTS[KEY],
    })
  })

  it("laisse l'environnement écraser le défaut", async () => {
    process.env[ENV_VAR] = String(!FEATURE_DEFAULTS[KEY])
    invalidateFeatureCache()

    const features = await getFeatures()
    expect(features[KEY]).toBe(!FEATURE_DEFAULTS[KEY])
  })

  it("ignore une valeur d'environnement qui n'est ni vraie ni fausse", async () => {
    process.env[ENV_VAR] = 'peut-être'
    invalidateFeatureCache()

    const features = await getFeatures()
    expect(features[KEY]).toBe(FEATURE_DEFAULTS[KEY])
  })

  it("laisse la base écraser l'environnement", async () => {
    // C'est ce qui rend la bascule à chaud possible : sans ça, une variable
    // posée sur Vercel condamnerait l'écran d'administration à l'impuissance.
    process.env[ENV_VAR] = 'true'
    await setFeatureFlag(KEY, false, 'admin@test.local')

    const features = await getFeatures()
    expect(features[KEY]).toBe(false)
  })

  it('ignore une ligne dont la clé a disparu du registre', async () => {
    await db.featureFlag.create({
      data: { key: 'flag.retire.du.code', enabled: true },
    })
    invalidateFeatureCache()

    const features = await getFeatures()
    expect(Object.keys(features).sort()).toEqual([...FEATURE_KEYS].sort())

    await db.featureFlag.deleteMany({ where: { key: 'flag.retire.du.code' } })
  })
})

describe('bascule', () => {
  it('journalise qui a basculé, et rend la main au reset', async () => {
    await setFeatureFlag(KEY, !FEATURE_DEFAULTS[KEY], 'admin@test.local')

    const afterSet = (await listFeatureFlags()).find((f) => f.key === KEY)!
    expect(afterSet.enabled).toBe(!FEATURE_DEFAULTS[KEY])
    expect(afterSet.source).toBe('database')
    expect(afterSet.updatedBy).toBe('admin@test.local')

    // Supprimer la ligne n'est pas la passer à `false` : c'est retirer un avis.
    await resetFeatureFlag(KEY)

    const afterReset = (await listFeatureFlags()).find((f) => f.key === KEY)!
    expect(afterReset.enabled).toBe(FEATURE_DEFAULTS[KEY])
    expect(afterReset.source).toBe('default')
    expect(afterReset.updatedBy).toBeNull()
  })

  it("invalide le cache immédiatement — sinon l'admin croirait à une panne", async () => {
    await getFeatures() // remplit le cache
    await setFeatureFlag(KEY, !FEATURE_DEFAULTS[KEY], 'admin@test.local')

    const features = await getFeatures()
    expect(features[KEY]).toBe(!FEATURE_DEFAULTS[KEY])
  })

  it('expose tous les flags déclarés, jamais ceux de la base seule', async () => {
    const rows = await listFeatureFlags()
    expect(rows.map((r) => r.key).sort()).toEqual([...FEATURE_KEYS].sort())
  })
})

describe('garde-fou serveur', () => {
  // Le test qui compte. Masquer le formulaire côté écran ne ferme rien : la
  // mutation reste appelable directement, comme n'importe quel appel d'API.
  // C'est `withFeature` qui la refuse réellement.
  function caller(selfSignup: boolean) {
    return createCaller({
      db,
      headers: new Headers(),
      user: {
        id: 'utilisateur-test',
        email: 'tourist@test.local',
        name: 'Touriste',
        role: 'tourist',
      },
      features: { ...FEATURE_DEFAULTS, 'operator.selfSignup': selfSignup },
    })
  }

  it('refuse operator.requestAccess quand le flag est éteint', async () => {
    await expect(
      caller(false).operator.requestAccess({ displayName: 'Contournement' }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('laisse passer la validation quand le flag est allumé', async () => {
    // L'utilisateur n'existe pas : la clé étrangère échouera. Ce qui compte est
    // que l'appel dépasse le middleware au lieu d'être arrêté par lui.
    await expect(
      caller(true).operator.requestAccess({ displayName: 'Nouvel opérateur' }),
    ).rejects.not.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })
})

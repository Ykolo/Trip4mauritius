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
import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
  withFeature,
} from '@/server/trpc/init'

// Le flag testé est un vrai flag du registre : un flag inventé pour les tests
// ne prouverait que le fonctionnement du flag inventé.
const KEY = 'whatsapp.contact' as const
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
    expect(featureEnvVar('whatsapp.contact')).toBe('FEATURE_WHATSAPP_CONTACT')
  })

  it('ne reconnaît pas une clé absente du registre', () => {
    expect(isFeatureKey('whatsapp.contact')).toBe(true)
    expect(isFeatureKey('flag.inexistant')).toBe(false)
    // `operator.selfSignup` a été retiré du registre au lot 1 : une clé
    // supprimée doit cesser d'être reconnue, sinon une ligne restée en base
    // continuerait d'être résolue en silence.
    expect(isFeatureKey('operator.selfSignup')).toBe(false)
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
  // Le test qui compte. Masquer un écran ne ferme rien : la mutation reste
  // appelable directement, comme n'importe quel appel d'API. C'est
  // `withFeature` qui la refuse réellement.
  //
  // Il s'exerce sur un router construit ici, et non sur une procédure de
  // l'application : depuis le lot 1, plus aucun flag ne garde de procédure
  // (`operator.selfSignup` a disparu avec l'auto-inscription). Tester le
  // middleware directement garde la couverture pour le prochain flag qui en
  // aura besoin — sans lui, `withFeature` deviendrait du code non vérifié.
  const router = createTRPCRouter({
    garde: protectedProcedure
      .use(withFeature(KEY))
      .query(() => 'passé'),
  })
  const callTestRouter = createCallerFactory(router)

  function caller(enabled: boolean) {
    return callTestRouter({
      db,
      headers: new Headers(),
      user: {
        id: 'utilisateur-test',
        email: 'tourist@test.local',
        name: 'Touriste',
        role: 'tourist',
      },
      features: { ...FEATURE_DEFAULTS, [KEY]: enabled },
    })
  }

  it('refuse la procédure quand le flag est éteint', async () => {
    await expect(caller(false).garde()).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
  })

  it('laisse passer quand le flag est allumé', async () => {
    await expect(caller(true).garde()).resolves.toBe('passé')
  })
})

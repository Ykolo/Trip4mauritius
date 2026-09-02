import { db } from '@/lib/db'
import {
  FEATURES,
  FEATURE_DEFAULTS,
  FEATURE_KEYS,
  featureEnvVar,
  isFeatureKey,
  type FeatureKey,
  type FeatureMap,
} from '@/lib/features'
import type { FeatureFlagRow, FeatureSource } from '@/types/admin'

// Résolution des interrupteurs de fonctionnalité, en cascade :
//
//     défaut (lib/features.ts)  ←  variable d'environnement  ←  base
//
// Chaque couche écrase la précédente, la base parle en dernier : c'est ce qui
// permet de basculer sans redéployer. L'environnement sert à différencier une
// preview d'une production AVANT que quiconque n'ouvre /admin/features.

const TRUTHY = new Set(['1', 'true', 'on', 'yes'])
const FALSY = new Set(['0', 'false', 'off', 'no'])

/**
 * Durée de vie du cache en mémoire.
 *
 * Sans lui, chaque rendu de page paierait une requête base uniquement pour
 * savoir s'il faut afficher un bouton. Contrepartie assumée : une bascule met
 * jusqu'à ce délai à se propager sur toutes les instances, ce que l'écran
 * d'administration annonce explicitement.
 */
const CACHE_TTL_MS = 30_000

let cached: { map: FeatureMap; expiresAt: number } | null = null

/** Un avertissement par variable mal écrite, pas un par requête. */
const warnedEnvVars = new Set<string>()

function fromEnv(): Partial<FeatureMap> {
  const overrides: Partial<FeatureMap> = {}

  for (const key of FEATURE_KEYS) {
    const raw = process.env[featureEnvVar(key)]?.trim().toLowerCase()
    if (!raw) continue

    if (TRUTHY.has(raw)) overrides[key] = true
    else if (FALSY.has(raw)) overrides[key] = false
    else if (!warnedEnvVars.has(key)) {
      // Ignorer en silence transformerait une faute de frappe en flag qui
      // « ne marche pas » sans que rien ne l'explique.
      warnedEnvVars.add(key)
      console.warn(
        `[features] ${featureEnvVar(key)}="${raw}" n'est ni vrai ni faux — variable ignorée.`,
      )
    }
  }

  return overrides
}

async function fromDatabase(): Promise<Partial<FeatureMap>> {
  const overrides: Partial<FeatureMap> = {}

  // La lecture des flags ne doit JAMAIS faire tomber une page. Elle est
  // exécutée par le layout racine, donc sur chaque rendu : une base
  // momentanément injoignable rendrait le site entier indisponible pour une
  // information d'affichage. On retombe sur environnement + défauts.
  try {
    for (const row of await db.featureFlag.findMany()) {
      // Clé absente du registre = flag retiré du code dont la ligne traîne.
      if (isFeatureKey(row.key)) overrides[row.key] = row.enabled
    }
  } catch (error) {
    console.error('[features] lecture base impossible, repli sur les défauts:', error)
  }

  return overrides
}

/** État résolu de tous les flags. Mis en cache `CACHE_TTL_MS`. */
export async function getFeatures(): Promise<FeatureMap> {
  if (cached && cached.expiresAt > Date.now()) return cached.map

  const map: FeatureMap = {
    ...FEATURE_DEFAULTS,
    ...fromEnv(),
    ...(await fromDatabase()),
  }

  cached = { map, expiresAt: Date.now() + CACHE_TTL_MS }
  return map
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  return (await getFeatures())[key]
}

/** Vide le cache local. Appelé après une écriture, et par les tests. */
export function invalidateFeatureCache(): void {
  cached = null
}

/**
 * Vue d'administration : tous les flags DÉCLARÉS, jamais ceux de la base.
 *
 * `source` compte autant que `enabled` : sans elle, un admin qui bascule un
 * flag et ne voit rien changer n'a aucun moyen de comprendre pourquoi.
 */
export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  const [resolved, rows] = await Promise.all([
    getFeatures(),
    db.featureFlag.findMany(),
  ])

  const stored = new Map(rows.map((row) => [row.key, row]))
  const envOverrides = fromEnv()
  const today = new Date().toISOString().slice(0, 10)

  return FEATURE_KEYS.map((key) => {
    const definition = FEATURES[key]
    const row = stored.get(key)

    const source: FeatureSource = row
      ? 'database'
      : envOverrides[key] !== undefined
        ? 'env'
        : 'default'

    return {
      key,
      label: definition.label,
      description: definition.description,
      enabled: resolved[key],
      defaultValue: definition.default,
      source,
      envVar: featureEnvVar(key),
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      expiresOn: definition.expiresOn,
      expired: definition.expiresOn < today,
    }
  })
}

/**
 * Bascule un flag.
 *
 * `updatedBy` est l'email de l'admin, figé ici : six mois plus tard, la seule
 * question qui se pose est « qui a éteint ça, et quand ».
 */
export async function setFeatureFlag(
  key: FeatureKey,
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled, updatedBy },
    update: { enabled, updatedBy },
  })

  invalidateFeatureCache()
}

/**
 * Rend la main à l'environnement et au défaut du code.
 *
 * Supprimer la ligne n'est PAS équivalent à la passer à `false` : c'est ce qui
 * distingue « décidé explicitement » de « pas d'avis ».
 */
export async function resetFeatureFlag(key: FeatureKey): Promise<void> {
  await db.featureFlag.deleteMany({ where: { key } })
  invalidateFeatureCache()
}

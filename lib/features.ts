// Registre des interrupteurs de fonctionnalité.
//
// Ce fichier est la SEULE déclaration de flags du projet. Il n'importe rien du
// serveur — ni `db`, ni `process.env` — parce qu'il est lu aussi bien par un
// composant client que par une procédure tRPC. La résolution (défaut ←
// environnement ← base) vit dans `server/services/features.ts`.
//
// ⚠️ Un flag n'est PAS une autorisation. Le désactiver côté écran ne fait que
// cacher un bouton : la procédure tRPC reste appelable directement. Tout flag
// qui protège une action doit aussi passer par `withFeature()`
// (`server/trpc/init.ts`) — même raisonnement que l'en-tête de `proxy.ts`.
//
// Ajouter un flag :
//   1. une entrée ici — l'écran /admin/features et la variable
//      d'environnement en découlent, il n'y a rien d'autre à déclarer ;
//   2. `useFeature('ma.cle')` là où l'écran change ;
//   3. `.use(withFeature('ma.cle'))` sur les procédures concernées, dès que le
//      flag protège autre chose que de l'affichage.
//
// Deux choses qu'un flag ne doit jamais faire : conditionner une migration (une
// colonne ajoutée reste ajoutée, la bascule ne reviendrait pas en arrière), et
// se disséminer dans les composants feuilles — on flague une frontière (une
// route, une section, une procédure), sinon le retrait devient impossible.

export interface FeatureDefinition {
  /** Libellé affiché dans /admin/features. */
  label: string
  /** Ce que la bascule change réellement, écran par écran. */
  description: string
  /** Valeur retenue quand ni l'environnement ni la base ne se prononcent. */
  default: boolean
  /**
   * Date au-delà de laquelle ce flag ne devrait plus exister.
   *
   * Un flag qu'on ne retire jamais devient une branche morte que plus personne
   * n'ose supprimer : les deux chemins doivent être maintenus indéfiniment.
   * `lib/features.test.ts` échoue une fois la date passée — soit on retire le
   * flag, soit on repousse la date, mais jamais par oubli.
   */
  expiresOn: string
}

export const FEATURES = {
  'operator.selfSignup': {
    label: 'Inscription autonome des opérateurs',
    description:
      "Laisse un touriste connecté demander un accès opérateur depuis /operator/dashboard. Désactivé, le formulaire disparaît et la procédure refuse : les profils opérateur ne peuvent plus être créés que par un admin.",
    default: true,
    expiresOn: '2027-03-31',
  },
  'currency.selector': {
    label: 'Sélecteur de devise',
    description:
      "Affiche le menu de devise du pied de page. ⚠️ Il ne convertit RIEN aujourd'hui — tous les montants restent en euros. À laisser désactivé tant que la conversion n'est pas branchée, sinon l'écran promet un choix qu'il n'honore pas.",
    default: true,
    expiresOn: '2027-03-31',
  },
  'whatsapp.contact': {
    label: 'Contact WhatsApp',
    description:
      "Affiche les points d'entrée WhatsApp (pied de page aujourd'hui, mise en relation touriste ↔ opérateur ensuite).",
    default: true,
    expiresOn: '2027-03-31',
  },
} as const satisfies Record<string, FeatureDefinition>

export type FeatureKey = keyof typeof FEATURES

/** État résolu de tous les flags — ce que reçoivent le rendu et le contexte tRPC. */
export type FeatureMap = Record<FeatureKey, boolean>

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export const FEATURE_DEFAULTS: FeatureMap = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, FEATURES[key].default]),
) as FeatureMap

/**
 * Une clé venue de l'extérieur (base, variable d'environnement) n'est pas
 * forcément déclarée : un flag retiré du code laisse sa ligne derrière lui.
 */
export function isFeatureKey(value: string): value is FeatureKey {
  return Object.hasOwn(FEATURES, value)
}

/** `operator.selfSignup` → `FEATURE_OPERATOR_SELF_SIGNUP`. */
export function featureEnvVar(key: FeatureKey): string {
  return `FEATURE_${key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\./g, '_')
    .toUpperCase()}`
}

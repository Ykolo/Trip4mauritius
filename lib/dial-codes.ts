// Indicatifs téléphoniques — liste FERMÉE.
//
// Même grammaire que `lib/regions.ts` et `lib/durations.ts`, et née du même
// besoin : un numéro saisi en texte libre produit un lien WhatsApp cassé sans
// que rien ne le signale. `wa.me/57891234` n'ouvre pas la conversation d'un
// mobile mauricien — il désigne un abonné américain, et l'admin croit que
// WhatsApp est en panne.
//
// La liste n'a pas vocation à couvrir les 195 pays : elle couvre les marchés
// d'où viennent les touristes de l'île et les pays voisins. En ajouter un est
// une ligne ici, et une seule — c'est précisément l'intérêt d'une liste fermée
// plutôt que d'un champ libre.
//
// ⚠️ L'ordre compte à l'affichage (Maurice en tête, c'est le cas courant) mais
// PAS à l'analyse d'un numéro existant : `splitPhone` trie par longueur
// décroissante, sinon « +1 » capturerait « +1 » dans « +1809 » et
// « +230 » ne serait jamais atteint.

export interface DialCode {
  /** Indicatif avec le « + ». C'est la valeur stockée, préfixée au numéro. */
  code: string
  /** Libellé affiché dans le sélecteur. */
  label: string
}

export const DIAL_CODES: readonly DialCode[] = [
  { code: '+230', label: 'Maurice' },
  { code: '+262', label: 'Réunion / Mayotte' },
  { code: '+33', label: 'France' },
  { code: '+32', label: 'Belgique' },
  { code: '+41', label: 'Suisse' },
  { code: '+44', label: 'Royaume-Uni' },
  { code: '+49', label: 'Allemagne' },
  { code: '+39', label: 'Italie' },
  { code: '+34', label: 'Espagne' },
  { code: '+31', label: 'Pays-Bas' },
  { code: '+351', label: 'Portugal' },
  { code: '+43', label: 'Autriche' },
  { code: '+46', label: 'Suède' },
  { code: '+45', label: 'Danemark' },
  { code: '+353', label: 'Irlande' },
  { code: '+1', label: 'États-Unis / Canada' },
  { code: '+27', label: 'Afrique du Sud' },
  { code: '+261', label: 'Madagascar' },
  { code: '+248', label: 'Seychelles' },
  { code: '+269', label: 'Comores' },
  { code: '+91', label: 'Inde' },
  { code: '+86', label: 'Chine' },
  { code: '+971', label: 'Émirats arabes unis' },
  { code: '+966', label: 'Arabie saoudite' },
  { code: '+61', label: 'Australie' },
  { code: '+7', label: 'Russie' },
  { code: '+48', label: 'Pologne' },
  { code: '+420', label: 'Tchéquie' },
] as const

/** Maurice : l'opérateur est local par définition, le touriste souvent aussi. */
export const DEFAULT_DIAL_CODE = '+230'

/** Indicatifs du plus long au plus court — voir l'avertissement en tête. */
const BY_LENGTH = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length)

export function isKnownDialCode(code: string): boolean {
  return DIAL_CODES.some((entry) => entry.code === code)
}

/**
 * Recompose un numéro complet à partir d'un indicatif et d'une partie
 * nationale. Le zéro de tête est retiré : un Français saisit « 06 12 34 56 78 »
 * par réflexe, et `+33 06…` est un numéro invalide — c'est `+33 6…` qu'attend
 * le réseau.
 */
export function joinPhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '')
  return digits ? `${dial} ${digits}` : ''
}

/**
 * Sépare un numéro stocké en { indicatif, partie nationale }, pour réafficher
 * un formulaire d'édition.
 *
 * Un numéro qui ne commence par aucun indicatif connu — tous ceux saisis en
 * texte libre AVANT l'arrivée de ce module — rend `dial: null`. L'appelant
 * choisit alors quoi faire : proposer l'indicatif par défaut, ou signaler qu'il
 * faut le renseigner. On ne DEVINE pas : supposer « +230 » sur le numéro d'un
 * touriste français composerait un inconnu à Maurice.
 */
export function splitPhone(value: string | null | undefined): {
  dial: string | null
  national: string
} {
  const raw = (value ?? '').trim()
  if (!raw) return { dial: null, national: '' }

  // On normalise les séparateurs pour comparer, mais on garde le « + » : c'est
  // lui qui distingue un indicatif d'un préfixe local.
  const compact = raw.replace(/[\s.\-()]/g, '')

  for (const entry of BY_LENGTH) {
    if (compact.startsWith(entry.code)) {
      return { dial: entry.code, national: compact.slice(entry.code.length) }
    }
  }

  return { dial: null, national: compact.replace(/^\+/, '') }
}

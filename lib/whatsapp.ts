// Point unique du contact WhatsApp.
//
// Le pied de page pointait sur `https://whatsapp.com` — l'accueil du service,
// pas une conversation : le visiteur qui cliquait n'atteignait personne. La
// barre du bas ajoute un second point d'entrée, et deux liens construits
// séparément divergeraient au premier changement de numéro.
//
// Le numéro vit dans `NEXT_PUBLIC_WHATSAPP_NUMBER` : il est public par nature
// (il finit dans le HTML), et le poser en variable évite un déploiement de code
// le jour où il change.
//
// ⚠️ L'affichage de ces liens reste conditionné au flag `whatsapp.contact`.
//
// Deux usages cohabitent ici, et c'est voulu :
//
//   1. le contact GÉNÉRAL de Trip4mauritius (ci-dessous), un numéro unique posé
//      par variable d'environnement, offert aux visiteurs du site public ;
//   2. le contact d'un OPÉRATEUR donné (plus bas), lu en base et propre à
//      chaque prestataire, réservé au back-office.
//
// Ils partagent la seule chose qui compte : la normalisation du numéro. `wa.me`
// n'accepte QUE des chiffres, et laisse la conversation s'ouvrir sur « numéro
// invalide » sans rien expliquer si on lui passe un « + » ou un espace.

/**
 * Ne garde que les chiffres. `+230 5789 1234` → `23057891234`.
 *
 * Le « + » disparaît : `wa.me` le refuse. L'indicatif pays, lui, est
 * indispensable — sans lui, `wa.me/57891234` désigne un abonné américain et non
 * le mauricien qu'on voulait joindre.
 */
export function toWhatsAppDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** Indicatif de Maurice, proposé comme exemple dans les formulaires. */
export const MAURITIUS_DIAL_CODE = '+230'

// ---------------------------------------------------------------------------
// Contact général Trip4mauritius
// ---------------------------------------------------------------------------

/** Format attendu par wa.me : indicatif pays inclus, sans « + », sans espaces. */
const FALLBACK_NUMBER = '2305000000'

export const WHATSAPP_NUMBER =
  toWhatsAppDigits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '') ||
  FALLBACK_NUMBER

/** Vrai tant que le vrai numéro n'a pas été posé — sert à ne pas promettre un contact qui n'aboutit pas. */
export const WHATSAPP_IS_PLACEHOLDER = WHATSAPP_NUMBER === FALLBACK_NUMBER

export function whatsappHref(message = 'Bonjour, je vous contacte depuis Trip4mauritius.'): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

// ---------------------------------------------------------------------------
// Contact d'un opérateur (back-office)
// ---------------------------------------------------------------------------

/**
 * Un numéro est utilisable s'il porte un indicatif pays plausible.
 *
 * Le MÊME prédicat valide la saisie (`lib/schemas/admin.ts`) et décide si le
 * bouton du back-office est actif. Deux implémentations laisseraient passer à
 * l'écriture un numéro que l'affichage refuserait ensuite d'utiliser, sans que
 * rien ne l'explique à l'admin.
 *
 * Bornes E.164 : 8 chiffres au minimum (un mobile mauricien en fait 8, l'ajout
 * de l'indicatif dépasse donc largement), 15 au maximum, limite de la norme.
 */
export function isUsableWhatsAppNumber(raw: string | null | undefined): boolean {
  if (!raw) return false
  const digits = toWhatsAppDigits(raw)
  return digits.length >= 8 && digits.length <= 15
}

/**
 * Lien `wa.me` vers un numéro précis, ou `null` s'il est inexploitable.
 *
 * On rend `null` plutôt qu'un lien mort : l'appelant désactive son bouton, et
 * l'admin comprend qu'il manque un numéro au lieu de croire que WhatsApp est
 * en panne.
 */
export function whatsAppLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!isUsableWhatsAppNumber(phone)) return null
  const digits = toWhatsAppDigits(phone as string)
  const query = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${digits}${query}`
}

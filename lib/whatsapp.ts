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

/** Format attendu par wa.me : indicatif pays inclus, sans « + », sans espaces. */
const FALLBACK_NUMBER = '2305000000'

export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || FALLBACK_NUMBER

/** Vrai tant que le vrai numéro n'a pas été posé — sert à ne pas promettre un contact qui n'aboutit pas. */
export const WHATSAPP_IS_PLACEHOLDER = WHATSAPP_NUMBER === FALLBACK_NUMBER

export function whatsappHref(message = 'Bonjour, je vous contacte depuis Trip4mauritius.'): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

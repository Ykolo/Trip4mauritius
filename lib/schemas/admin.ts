import { z } from 'zod'
import { ADMIN_SETTABLE_STATUSES } from '@/lib/booking-status'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'
import { activityInputSchema } from '@/lib/schemas/operator'
import { isUsableWhatsAppNumber } from '@/lib/whatsapp'

// Aucun schéma ne porte de `role` : le rôle est décidé par la procédure
// appelée (`createOperator`), jamais par une valeur venue de la requête. Un
// champ `role` libre ici suffirait à transformer la création d'opérateur en
// fabrique d'administrateurs.

// Le numéro WhatsApp est validé par le MÊME prédicat que celui qui décide, à
// l'affichage, si le bouton du back-office est actif (`lib/whatsapp.ts`). Un
// `z.string()` nu laisserait entrer « à demander » ou « 5789 1234 » sans
// indicatif : la ligne serait acceptée, et le bouton resterait mystérieusement
// grisé sans que rien ne l'explique.
//
// Une chaîne vide vaut « pas de numéro » et devient `null` : c'est ce que
// renvoie un champ de formulaire qu'on vide, et le refuser interdirait de
// retirer un numéro devenu faux.
const whatsapp = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === '' || isUsableWhatsAppNumber(value), {
    message:
      'Indiquez le numéro au format international, indicatif compris (+230 5789 1234).',
  })
  .transform((value) => (value === '' ? null : value))
  .nullish()

// Les champs d'identité d'un opérateur, déclarés UNE fois et partagés par la
// création et l'édition. Deux listes jumelles auraient fini par diverger sur
// une borne — un `max(120)` d'un côté, rien de l'autre — et l'écran d'édition
// aurait accepté ce que la création refuse.
const operatorIdentityFields = {
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  whatsapp,
}

export const createOperatorSchema = z.object(operatorIdentityFields)

/**
 * Édition d'un opérateur existant.
 *
 * `setOperatorWhatsapp` a disparu au profit de cette procédure : le numéro
 * était le seul champ modifiable, et le garder à part aurait laissé DEUX
 * chemins d'écriture sur la même colonne. Le second aurait tôt ou tard oublié
 * une validation que le premier applique.
 *
 * Toujours aucun `role` — comme partout dans ce fichier. L'édition change une
 * fiche, jamais des droits.
 *
 * L'email EST modifiable, contrairement à celui d'un touriste (lecture seule
 * sur /account, faute de vérification d'adresse). La raison est asymétrique :
 * l'admin saisit lui-même l'adresse de l'opérateur à la création, et une faute
 * de frappe rend le compte définitivement inconnectable — le titulaire ne peut
 * même pas demander une réinitialisation. Il faut donc un chemin de correction.
 */
export const updateOperatorSchema = z.object({
  operatorId: z.string().min(1),
  ...operatorIdentityFields,
  // Vide vaut « pas d'avatar » et devient `null` : c'est ce que renvoie un
  // champ de formulaire qu'on efface, et le refuser interdirait de retirer une
  // image devenue morte. Même grammaire que `whatsapp` ci-dessus.
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), {
      message: 'Indiquez un chemin interne (/images/…) ou une URL http(s).',
    })
    .transform((v) => (v === '' ? null : v))
    .nullish(),
})

export const operatorIdSchema = z.object({
  operatorId: z.string().min(1),
})

export const setOperatorActiveSchema = z.object({
  operatorId: z.string().min(1),
  active: z.boolean(),
})

// La cible est bornée par `ADMIN_SETTABLE_STATUSES`, la MÊME liste qui type les
// transitions et dessine les boutons de l'écran. Recopier les quatre valeurs
// ici aurait créé une troisième liste, et c'est toujours la même histoire.
//
// Le contrôle de la transition elle-même (d'où vers où) vit dans le service,
// qui seul connaît l'état de départ.
export const setBookingStatusSchema = z.object({
  bookingId: z.string().min(1),
  status: z.enum(ADMIN_SETTABLE_STATUSES),
})

// La clé est validée contre le REGISTRE, pas contre `z.string()` : une clé
// inventée est refusée à la frontière plutôt que d'écrire en base une ligne
// que la résolution ignorera ensuite en silence.
const featureKeySchema = z.enum(FEATURE_KEYS as [FeatureKey, ...FeatureKey[]])

export const setFeatureSchema = z.object({
  key: featureKeySchema,
  enabled: z.boolean(),
})

export const resetFeatureSchema = z.object({
  key: featureKeySchema,
})

// Listings du back-office.
//
// `search` est plafonné : sans borne, une chaîne de plusieurs kilo-octets
// partirait en `contains` sur trois colonnes à chaque frappe.
const search = z.string().trim().max(120).optional()
const page = z.number().int().min(1).default(1)

export const adminBookingsSchema = z.object({
  page,
  search,
  status: z
    .enum([
      'all',
      'pending_validation',
      'pending_payment',
      'confirmed',
      'cancelled',
      'expired',
      'completed',
    ])
    .default('all'),
  // « À venir » par défaut : c'est la seule tranche sur laquelle un admin peut
  // encore agir. Ouvrir sur l'historique complet noierait ces départs-là.
  period: z.enum(['all', 'upcoming', 'past']).default('upcoming'),
})

export type AdminBookingsInput = z.infer<typeof adminBookingsSchema>
export type CreateOperatorInput = z.infer<typeof createOperatorSchema>
export type UpdateOperatorInput = z.infer<typeof updateOperatorSchema>

// Catalogue.
//
// On RÉUTILISE `activityInputSchema` de l'espace opérateur : c'est la même
// entité, validée par les mêmes bornes. Un second schéma « admin » aurait
// autorisé, au premier assouplissement, une fiche que l'opérateur ne peut pas
// rouvrir dans son propre formulaire.
//
// `operatorId` est ici EXPLICITE, contrairement au schéma opérateur qui
// l'interdit : un admin publie forcément pour le compte de quelqu'un, et rien
// dans son contexte de session ne dit pour qui. C'est un choix, donc une entrée.

export const adminActivitiesSchema = z.object({
  page,
  search,
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  operatorId: z.string().trim().min(1).optional(),
})

export const adminCreateActivitySchema = z.object({
  operatorId: z.string().min(1),
  data: activityInputSchema,
})

export const adminUpdateActivitySchema = z.object({
  activityId: z.string().min(1),
  data: activityInputSchema,
})

/**
 * Les statuts qu'un admin pose à la main.
 *
 * C'est aujourd'hui l'énumération ENTIÈRE : `pending_moderation` et `rejected`
 * en étaient exclus tant qu'ils existaient, parce que la file de modération les
 * produisait elle-même sous sa propre garde de concurrence. Cette file a
 * disparu au lot 13 et les deux valeurs avec elle — il ne reste donc plus
 * d'état que l'admin ne puisse pas choisir, et c'est ce que l'écran offre.
 *
 * La liste reste néanmoins déclarée ici plutôt que dérivée de `ActivityStatus` :
 * « ce que la colonne peut contenir » et « ce qu'un humain peut poser depuis le
 * back-office » sont deux questions distinctes, et leur égalité actuelle est un
 * fait, pas une règle. Le jour où un état machine apparaît, c'est cette ligne
 * qu'on ne veut pas voir le suivre en silence.
 */
export const adminActivityStatusSchema = z.object({
  activityId: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']),
})

export type AdminActivitiesInput = z.infer<typeof adminActivitiesSchema>
export type AdminActivityStatus = z.infer<
  typeof adminActivityStatusSchema
>['status']

// Catégories.
//
// Aucun schéma n'accepte de `slug` : il est dérivé du libellé à la création et
// n'est PLUS jamais modifiable. Il vit dans l'URL des recherches filtrées, que
// les touristes partagent et que les moteurs ont indexées.
const categoryFields = {
  label: z.string().trim().min(2).max(40),
  emoji: z.string().trim().max(8).optional(),
  imageUrl: z.string().trim().max(500).optional(),
}

export const createCategorySchema = z.object(categoryFields)

export const updateCategorySchema = z.object({
  categoryId: z.string().min(1),
  ...categoryFields,
})

export const setCategoryActiveSchema = z.object({
  categoryId: z.string().min(1),
  active: z.boolean(),
})

export const moveCategorySchema = z.object({
  categoryId: z.string().min(1),
  direction: z.enum(['up', 'down']),
})

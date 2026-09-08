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

export const createOperatorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  whatsapp,
})

export const setOperatorWhatsappSchema = z.object({
  operatorId: z.string().min(1),
  whatsapp,
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
export type SetOperatorWhatsappInput = z.infer<typeof setOperatorWhatsappSchema>

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
  status: z
    .enum([
      'all',
      'draft',
      'pending_moderation',
      'published',
      'rejected',
      'archived',
    ])
    .default('all'),
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
 * Les seuls statuts qu'un admin pose à la main.
 *
 * `pending_moderation` et `rejected` en sont absents : ce sont les états de la
 * file de modération, produits par la soumission d'un opérateur et par
 * `rejectActivity`. Les rendre posables ici donnerait deux chemins vers le même
 * état, dont un sans la garde de concurrence de la file.
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

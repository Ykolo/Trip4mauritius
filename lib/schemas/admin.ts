import { z } from 'zod'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'

// Aucun schéma ne porte de `role` : la promotion est décidée par la procédure
// appelée (`approveOperator`), jamais par une valeur venue de la requête. Un
// champ `role` libre ici suffirait à transformer la modération en fabrique
// d'administrateurs.

export const moderationQueueSchema = z.object({
  // Seuls les états qu'un admin a une raison de parcourir. `draft` en est
  // absent volontairement : un brouillon appartient à son opérateur tant qu'il
  // ne l'a pas soumis.
  status: z
    .enum(['pending_moderation', 'published', 'rejected', 'archived'])
    .default('pending_moderation'),
})

export const activityIdSchema = z.object({
  activityId: z.string().min(1),
})

export const operatorIdSchema = z.object({
  operatorId: z.string().min(1),
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

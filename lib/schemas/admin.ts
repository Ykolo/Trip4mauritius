import { z } from 'zod'

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

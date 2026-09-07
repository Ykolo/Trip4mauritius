import { z } from 'zod'

// Zod valide la FORME, pas la véracité. Le statut est accepté ici parce que
// c'est Trip4mauritius qui publie ses propres articles : il n'y a pas de
// modération au lot 1, donc pas de tiers à protéger d'une auto-publication.
// C'est l'inverse des activités, dont le statut n'est pas dans l'input.

/**
 * Les images sont des URLs, jamais des fichiers.
 *
 * `data:` est refusé explicitement, comme pour les activités : un base64 en
 * base serait relu en entier à chaque affichage de la liste.
 */
const imageUrl = z
  .string()
  .min(1)
  .max(2000)
  .refine((v) => !v.trim().toLowerCase().startsWith('data:'), {
    message: 'Les images se saisissent en URL, pas en fichier encodé.',
  })

export const guideInputSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(500),
  content: z.string().min(1).max(50_000),
  categoryId: z.string().min(1),
  imageUrls: z.array(imageUrl).max(10).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
})

export const guideIdSchema = z.object({ guideId: z.string().min(1) })

export const createGuideSchema = guideInputSchema
export const updateGuideSchema = z.object({
  guideId: z.string().min(1),
  data: guideInputSchema,
})

export const guideCategoryIdSchema = z.object({
  categoryId: z.string().min(1),
})

export const createGuideCategorySchema = z.object({
  label: z.string().min(1).max(80),
})

export const renameGuideCategorySchema = z.object({
  categoryId: z.string().min(1),
  label: z.string().min(1).max(80),
})

export const setGuideCategoryActiveSchema = z.object({
  categoryId: z.string().min(1),
  active: z.boolean(),
})

/** Filtre public : un SLUG de catégorie, jamais un libellé. */
export const publicGuidesSchema = z.object({
  category: z.string().optional(),
})

export type GuideInputSchema = z.infer<typeof guideInputSchema>

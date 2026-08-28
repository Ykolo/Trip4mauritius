import { z } from 'zod'

// Un schéma, trois usages : input tRPC, parsing des searchParams côté RSC,
// et source de types. Les filtres vivant déjà dans l'URL, le serveur peut
// rendre une liste filtrée — donc indexable.

/** Accepte `?region=North&region=East` comme `?region=North,East`. */
const stringList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined
    const arr = Array.isArray(v) ? v : v.split(',')
    const cleaned = arr.map((s) => s.trim()).filter(Boolean)
    return cleaned.length > 0 ? cleaned : undefined
  })

const positiveNumber = z.coerce.number().nonnegative().optional()

export const activityFiltersSchema = z.object({
  region: stringList,
  category: stringList,
  lang: stringList,
  minPrice: positiveNumber,
  maxPrice: positiveNumber,
  duration: z
    .string()
    .optional()
    .transform((v) => (v && v !== 'Any' ? v : undefined)),
  page: z.coerce.number().int().min(1).catch(1).default(1),
})

export type ActivityFiltersInput = z.infer<typeof activityFiltersSchema>

export const activitySlugSchema = z.object({
  slug: z.string().min(1),
})

/**
 * Les 5 langues sont obligatoires : un objet partiel casse l'affichage sans
 * lever d'erreur, donc on refuse à l'écriture plutôt que de déboguer au rendu.
 */
export const activityDescriptionSchema = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
  de: z.string().min(1),
  es: z.string().min(1),
  ru: z.string().min(1),
})

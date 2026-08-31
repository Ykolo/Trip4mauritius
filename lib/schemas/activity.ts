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

export const ACTIVITY_LOCALES = ['fr', 'en', 'de', 'es', 'ru'] as const
export type ActivityLocale = (typeof ACTIVITY_LOCALES)[number]

/**
 * Description multilingue : le FRANÇAIS seul est obligatoire.
 *
 * Les 5 langues étaient exigées à l'écriture pour qu'un objet partiel ne casse
 * jamais l'affichage. L'intention était bonne, le moyen non : un opérateur
 * mauricien n'écrit pas le russe, il colle son texte français dans les cinq
 * champs — et la base finit par affirmer qu'une traduction existe là où il n'y
 * a qu'un copier-coller, sans qu'on puisse plus distinguer les deux.
 *
 * On stocke donc UNIQUEMENT ce qui a été réellement saisi, et le repli sur le
 * français se fait à la lecture, dans `server/mappers/activity.ts`. L'invariant
 * qui compte — l'affichage ne casse jamais — est préservé, et il l'est en un
 * seul endroit.
 */
export const activityDescriptionSchema = z.object({
  fr: z.string().min(1, 'La description en français est obligatoire'),
  en: z.string().optional(),
  de: z.string().optional(),
  es: z.string().optional(),
  ru: z.string().optional(),
})

export type ActivityDescriptionInput = z.infer<typeof activityDescriptionSchema>

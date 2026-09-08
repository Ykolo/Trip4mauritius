import { z } from 'zod'
import { DURATIONS } from '@/lib/durations'
import { REGION_VALUES } from '@/lib/regions'
import { activityDescriptionSchema } from '@/lib/schemas/activity'

// Schémas d'écriture de l'espace opérateur.
//
// Aucun `operatorId` ici, JAMAIS : il vient de `ctx.operator.id`, garanti par
// `operatorProcedure`. L'accepter en entrée suffirait à publier sous l'identité
// d'un autre opérateur.
// De même, aucun `status` : les transitions sont des procédures dédiées, pas un
// champ libre — sinon un opérateur se publierait lui-même sans modération.

const trimmedList = z
  .array(z.string().trim().min(1))
  .max(20)
  .default([])
  // Les champs répétables du formulaire arrivent avec des lignes vides quand
  // l'utilisateur en ajoute une puis change d'avis.
  .transform((items) => items.filter(Boolean))

/**
 * Les images sont des URLs, pas des fichiers.
 *
 * L'upload passera par Vercel Blob quand le stockage sera provisionné. En
 * attendant, on refuse explicitement les `data:` — un base64 de 1 Mo inséré
 * dans `imageUrls` serait relu à CHAQUE affichage de la fiche et du catalogue.
 */
const imageUrl = z
  .string()
  .trim()
  .min(1)
  .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
    message: 'Indiquez un chemin interne (/images/…) ou une URL http(s).',
  })

export const activityInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  // L'id d'une catégorie existante, plus un texte libre : la clé étrangère
  // refuse une valeur inventée. Avant, un opérateur pouvait écrire n'importe
  // quoi et son activité n'apparaissait dans aucun filtre.
  categoryId: z.string().trim().min(1),
  // Région et durée sont des listes FERMÉES, pas du texte libre — pour la même
  // raison que `categoryId` ci-dessus. Laissées ouvertes, elles ont laissé la
  // base accumuler deux vocabulaires concurrents (`Full day` à côté de
  // `Journée`), et les activités saisies avec le mauvais n'apparaissaient dans
  // aucun filtre. Les valeurs affichées viennent des mêmes constantes.
  region: z.enum(REGION_VALUES),
  duration: z.enum(DURATIONS),
  description: activityDescriptionSchema,
  // Le prix est en euros par personne. Le plafond n'est pas cosmétique : la
  // colonne est un Decimal(10,2), au-delà l'insertion échouerait en base.
  priceHT: z.number().nonnegative().max(99_999_999),
  maxParticipants: z.number().int().min(1).max(500),
  languages: z.array(z.string().trim().min(1)).min(1).max(10),
  imageUrls: z.array(imageUrl).min(1, 'Au moins une image').max(10),
  included: trimmedList,
  excluded: trimmedList,
})

export const updateActivitySchema = z.object({
  activityId: z.string().min(1),
  data: activityInputSchema,
})

export const activityIdSchema = z.object({
  activityId: z.string().min(1),
})

/**
 * Un créneau se saisit en heure MURALE mauricienne — c'est ce que l'opérateur
 * lit sur son planning. La conversion en instant UTC est faite côté serveur par
 * `fromMauritiusWallClock` : accepter un ISO du navigateur ferait entrer le
 * fuseau du poste de l'opérateur dans la base.
 */
export const slotInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  maxSpots: z.number().int().min(1).max(500),
})

export const createSlotsSchema = z.object({
  activityId: z.string().min(1),
  slots: z.array(slotInputSchema).min(1).max(60),
})

export const deleteSlotSchema = z.object({
  slotId: z.string().min(1),
})

export const operatorProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  avatarUrl: z.string().trim().url().or(z.literal('')).optional(),
})



export const operatorBookingsSchema = z.object({
  page: z.number().int().min(1).default(1),
})

export type ActivityInput = z.infer<typeof activityInputSchema>
export type SlotInput = z.infer<typeof slotInputSchema>

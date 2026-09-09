import { z } from 'zod'

// Zod valide la FORME, jamais la véracité.
//
// Aucun montant ne figure dans ces schémas, et c'est délibéré : accepter un
// prix venu du client, même validé, reviendrait à le croire. Le serveur relit
// `Activity.priceHt` et recalcule tout (cf. server/services/booking.ts).

// Le vrai plafond est `Activity.maxParticipants`, vérifié en base au moment de
// réserver. Cette borne-ci n'est qu'un garde-fou de charge.
const participants = z.number().int().min(1).max(50)

/**
 * Une ligne de panier — sur créneau OU à la journée.
 *
 * Union DISCRIMINÉE et non un objet aux champs tous facultatifs : ce dernier
 * aurait accepté une ligne portant à la fois un `slotId` et une période, que le
 * service aurait dû arbitrer et que `bookings_mode_shape` refuse en base. Ici,
 * les deux formes sont incompatibles par construction et TypeScript force à
 * traiter les deux cas.
 */
const slotLineSchema = z.object({
  mode: z.literal('slot'),
  slotId: z.string().min(1),
  participants,
})

/**
 * Une période saisie en HEURE MURALE MAURICIENNE, jamais un ISO du navigateur.
 *
 * Même doctrine que `slotInputSchema` (`lib/schemas/operator.ts`) : la
 * conversion en instant UTC appartient au serveur (`fromMauritiusWallClock`).
 * Accepter un ISO fabriqué côté client ferait entrer le fuseau du touriste dans
 * la base — un Parisien réserverait sa voiture pour 07:00 en croyant avoir
 * choisi 09:00.
 */
const dailyLineSchema = z.object({
  mode: z.literal('daily'),
  activityId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  // Combien de personnes, pas combien on facture : en mode journée le prix est
  // celui du jour, quel qu'en soit l'occupant. Sert au plafond de capacité
  // (`maxParticipants` = les places du véhicule) et à prévenir l'opérateur.
  participants,
})

export const bookingLineSchema = z.discriminatedUnion('mode', [
  slotLineSchema,
  dailyLineSchema,
])

export const createBookingSchema = z.object({
  items: z.array(bookingLineSchema).min(1).max(10),
  // Le numéro que l'opérateur composera pour ce départ. Volontairement peu
  // contraint : les formats mauriciens, réunionnais et européens cohabitent, et
  // une regex trop stricte rejetterait des numéros valides.
  contactPhone: z
    .string()
    .trim()
    .min(6, 'Numéro de téléphone trop court')
    .max(30),
})

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
})

export type BookingLineInput = z.infer<typeof bookingLineSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>

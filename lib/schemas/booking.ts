import { z } from 'zod'

// Zod valide la FORME, jamais la véracité.
//
// Aucun montant ne figure dans ces schémas, et c'est délibéré : accepter un
// prix venu du client, même validé, reviendrait à le croire. Le serveur relit
// `Activity.priceHt` et recalcule tout (cf. server/services/booking.ts).

/** Une ligne de panier : un créneau, un nombre de participants. */
export const bookingLineSchema = z.object({
  slotId: z.string().min(1),
  // Le vrai plafond est `Activity.maxParticipants`, vérifié en base au moment
  // de réserver. Cette borne-ci n'est qu'un garde-fou de charge.
  participants: z.number().int().min(1).max(50),
})

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

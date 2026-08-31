import { cancelBookingSchema, createBookingSchema } from '@/lib/schemas/booking'
import {
  cancelBooking,
  createBookings,
  listMyBookings,
} from '@/server/services/booking'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

// Router mince : valider, autoriser, déléguer.
//
// Tout est en `protectedProcedure` — le typage rend `ctx.user` non-nullable, et
// c'est TOUJOURS `ctx.user.id` qui est transmis au service, jamais un id venu
// de l'input. Un utilisateur ne peut donc pas réserver ni annuler au nom d'un
// autre, même en forgeant sa requête.

export const bookingRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => listMyBookings(ctx.user.id)),

  create: protectedProcedure
    .input(createBookingSchema)
    .mutation(({ ctx, input }) =>
      createBookings({
        userId: ctx.user.id,
        lines: input.items,
        contactPhone: input.contactPhone,
      }),
    ),

  cancel: protectedProcedure
    .input(cancelBookingSchema)
    .mutation(({ ctx, input }) =>
      cancelBooking({ userId: ctx.user.id, bookingId: input.bookingId }),
    ),
})

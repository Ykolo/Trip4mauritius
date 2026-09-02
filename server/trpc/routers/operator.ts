import {
  activityIdSchema,
  createSlotsSchema,
  deleteSlotSchema,
  activityInputSchema,
  operatorBookingsSchema,
  operatorProfileSchema,
  requestAccessSchema,
  updateActivitySchema,
} from '@/lib/schemas/operator'
import {
  archiveActivity,
  createActivity,
  createSlots,
  deleteSlot,
  getMyOperatorProfile,
  getOperatorActivity,
  getOperatorStats,
  listOperatorActivities,
  listOperatorBookings,
  listUpcomingDepartures,
  requestOperatorAccess,
  submitForModeration,
  updateActivity,
  updateOperatorProfile,
} from '@/server/services/operator'
import {
  createTRPCRouter,
  operatorProcedure,
  protectedProcedure,
  withFeature,
} from '@/server/trpc/init'

// Router mince : valider, autoriser, déléguer.
//
// Tout ce qui touche aux données d'un opérateur est en `operatorProcedure`, qui
// garantit `ctx.operator` au niveau du TYPE. C'est le vrai gain de tRPC ici :
// `ctx.operator.id` existant statiquement, aucune procédure ne peut oublier son
// filtre par distraction — elle ne compilerait pas sans lui.
//
// Deux exceptions en `protectedProcedure`, et seulement deux : la demande
// d'accès et la lecture de son propre statut, qu'un touriste doit pouvoir
// appeler puisqu'il n'est justement pas encore opérateur.

export const operatorRouter = createTRPCRouter({
  // ── Accessible à tout compte connecté ──────────────────────────────────
  myProfile: protectedProcedure.query(({ ctx }) =>
    getMyOperatorProfile(ctx.user.id),
  ),

  // Fermée quand `operator.selfSignup` est éteint. Le formulaire disparaît
  // aussi côté écran, mais c'est CE garde-fou qui compte : cacher un bouton ne
  // rend pas la mutation inappelable.
  requestAccess: protectedProcedure
    .use(withFeature('operator.selfSignup'))
    .input(requestAccessSchema)
    .mutation(({ ctx, input }) =>
      requestOperatorAccess(ctx.user.id, input.displayName),
    ),

  // ── Réservé aux opérateurs ─────────────────────────────────────────────
  stats: operatorProcedure.query(({ ctx }) => getOperatorStats(ctx.operator.id)),

  upcomingDepartures: operatorProcedure.query(({ ctx }) =>
    listUpcomingDepartures(ctx.operator.id),
  ),

  listActivities: operatorProcedure.query(({ ctx }) =>
    listOperatorActivities(ctx.operator.id),
  ),

  getActivity: operatorProcedure
    .input(activityIdSchema)
    .query(({ ctx, input }) =>
      getOperatorActivity(ctx.operator.id, input.activityId),
    ),

  listBookings: operatorProcedure
    .input(operatorBookingsSchema)
    .query(({ ctx, input }) =>
      listOperatorBookings(ctx.operator.id, input.page),
    ),

  createActivity: operatorProcedure
    .input(activityInputSchema)
    .mutation(({ ctx, input }) => createActivity(ctx.operator.id, input)),

  updateActivity: operatorProcedure
    .input(updateActivitySchema)
    .mutation(({ ctx, input }) =>
      updateActivity(ctx.operator.id, input.activityId, input.data),
    ),

  submitForModeration: operatorProcedure
    .input(activityIdSchema)
    .mutation(({ ctx, input }) =>
      submitForModeration(ctx.operator.id, input.activityId),
    ),

  archiveActivity: operatorProcedure
    .input(activityIdSchema)
    .mutation(({ ctx, input }) =>
      archiveActivity(ctx.operator.id, input.activityId),
    ),

  createSlots: operatorProcedure
    .input(createSlotsSchema)
    .mutation(({ ctx, input }) =>
      createSlots(ctx.operator.id, input.activityId, input.slots),
    ),

  deleteSlot: operatorProcedure
    .input(deleteSlotSchema)
    .mutation(({ ctx, input }) => deleteSlot(ctx.operator.id, input.slotId)),

  updateProfile: operatorProcedure
    .input(operatorProfileSchema)
    .mutation(({ ctx, input }) =>
      updateOperatorProfile(ctx.operator.id, input),
    ),
})

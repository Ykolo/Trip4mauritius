import {
  activityIdSchema,
  moderationQueueSchema,
  operatorIdSchema,
} from '@/lib/schemas/admin'
import {
  approveOperator,
  getOverview,
  listActivitiesForModeration,
  listOperatorRequests,
  publishActivity,
  rejectActivity,
  revokeOperator,
} from '@/server/services/admin'
import { adminProcedure, createTRPCRouter } from '@/server/trpc/init'

// Tout est en `adminProcedure`, sans exception.
//
// Ce router expose les brouillons de tous les opérateurs et l'identité derrière
// chaque nom commercial : une seule procédure laissée en `protectedProcedure`
// par distraction ouvrirait tout cela à n'importe quel compte connecté.

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(() => getOverview()),

  moderationQueue: adminProcedure
    .input(moderationQueueSchema)
    .query(({ input }) => listActivitiesForModeration(input.status)),

  publishActivity: adminProcedure
    .input(activityIdSchema)
    .mutation(({ input }) => publishActivity(input.activityId)),

  rejectActivity: adminProcedure
    .input(activityIdSchema)
    .mutation(({ input }) => rejectActivity(input.activityId)),

  operatorRequests: adminProcedure.query(() => listOperatorRequests()),

  approveOperator: adminProcedure
    .input(operatorIdSchema)
    .mutation(({ input }) => approveOperator(input.operatorId)),

  revokeOperator: adminProcedure
    .input(operatorIdSchema)
    .mutation(({ input }) => revokeOperator(input.operatorId)),
})

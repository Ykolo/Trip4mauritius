import { TRPCError } from '@trpc/server'
import {
  activityFiltersSchema,
  activitySlugSchema,
} from '@/lib/schemas/activity'
import { getActivityBySlug, listActivities } from '@/server/services/activity'
import { createTRPCRouter, publicProcedure } from '@/server/trpc/init'

// Router mince : valider, autoriser, déléguer au service.
// La logique de lecture vit dans server/services/activity.ts, partagée avec les
// composants serveur des pages publiques.

export const activityRouter = createTRPCRouter({
  list: publicProcedure
    .input(activityFiltersSchema)
    .query(({ input }) => listActivities(input)),

  bySlug: publicProcedure
    .input(activitySlugSchema)
    .query(async ({ input }) => {
      const activity = await getActivityBySlug(input.slug)
      if (!activity) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      return activity
    }),
})

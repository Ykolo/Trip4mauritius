import { TRPCError } from '@trpc/server'
import {
  activityFiltersSchema,
  activitySlugSchema,
} from '@/lib/schemas/activity'
import { getActivityBySlug, listActivities } from '@/server/services/activity'
import { listActiveCategories } from '@/server/services/category'
import { createTRPCRouter, publicProcedure } from '@/server/trpc/init'

// Router mince : valider, autoriser, déléguer au service.
// La logique de lecture vit dans server/services/activity.ts, partagée avec les
// composants serveur des pages publiques.

export const activityRouter = createTRPCRouter({
  /**
   * Source unique des catégories pour TOUS les écrans : vignettes de
   * l'accueil, tiroir de filtres, formulaire opérateur.
   *
   * Ces trois-là portaient chacun sa propre liste en dur, et les trois
   * divergeaient — d'où des vignettes d'accueil qui ne renvoyaient aucun
   * résultat.
   */
  categories: publicProcedure.query(() => listActiveCategories()),

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

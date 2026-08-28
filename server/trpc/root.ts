import { activityRouter } from '@/server/trpc/routers/activity'
import { createCallerFactory, createTRPCRouter } from '@/server/trpc/init'

export const appRouter = createTRPCRouter({
  activity: activityRouter,
  // TODO — booking (lot 6), operator (lot 7), admin (lot 8)
})

export type AppRouter = typeof appRouter

/**
 * Caller serveur : permet d'appeler les procédures depuis un composant serveur
 * sans passer par HTTP. Les pages publiques préfèrent appeler les services
 * directement, mais ceci reste utile là où l'autorisation doit s'appliquer.
 */
export const createCaller = createCallerFactory(appRouter)

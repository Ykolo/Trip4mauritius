import { activityRouter } from '@/server/trpc/routers/activity'
import { bookingRouter } from '@/server/trpc/routers/booking'
import { operatorRouter } from '@/server/trpc/routers/operator'
import { adminRouter } from '@/server/trpc/routers/admin'
import { createCallerFactory, createTRPCRouter } from '@/server/trpc/init'

export const appRouter = createTRPCRouter({
  activity: activityRouter,
  booking: bookingRouter,
  operator: operatorRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter

/**
 * Caller serveur : permet d'appeler les procédures depuis un composant serveur
 * sans passer par HTTP. Les pages publiques préfèrent appeler les services
 * directement, mais ceci reste utile là où l'autorisation doit s'appliquer.
 */
export const createCaller = createCallerFactory(appRouter)

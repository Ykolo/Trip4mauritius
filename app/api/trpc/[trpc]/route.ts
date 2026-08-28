import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createTRPCContext } from '@/server/trpc/init'
import { appRouter } from '@/server/trpc/root'

// Runtime Node.js explicite : Prisma et le driver pg en ont besoin.
// Ne PAS passer en edge — voir docs/BACKEND-PLAN.md §1.
export const runtime = 'nodejs'

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(`tRPC ${path ?? '<no-path>'}: ${error.message}`)
          }
        : undefined,
  })
}

export { handler as GET, handler as POST }

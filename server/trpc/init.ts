import { initTRPC, TRPCError } from '@trpc/server'
import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Contexte et procédures tRPC.
//
// Pas de superjson : les mappers (server/mappers/*) convertissent Date et
// Decimal en types JSON purs à la frontière. Le contrat de sortie est donc
// sérialisable par construction, ce qui évite une dépendance et un coût de
// (dé)sérialisation à chaque appel.

export type SessionUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

export type TRPCContext = {
  db: typeof db
  headers: Headers
  user: SessionUser | null
}

/**
 * Session lue depuis Better Auth.
 *
 * Le rôle vient de la session (additionalFields) et non d'une requête base à
 * chaque appel. Contrepartie assumée : une promotion opérateur/admin ne prend
 * effet qu'au rafraîchissement du cache de session (5 min, cf. lib/auth.ts).
 */
async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers })
  if (!session?.user) return null

  const user = session.user as typeof session.user & { role?: UserRole }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Repli sur `tourist` : un rôle absent ne doit jamais être interprété
    // comme un privilège.
    role: user.role ?? 'tourist',
  }
}

export async function createTRPCContext(opts: {
  headers: Headers
}): Promise<TRPCContext> {
  return {
    db,
    headers: opts.headers,
    user: await getSessionUser(opts.headers),
  }
}

const t = initTRPC.context<TRPCContext>().create()

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

/** Aucune garantie. */
export const publicProcedure = t.procedure

/** Garantit `ctx.user` non-null — le typage le rend impossible à oublier. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

/**
 * Garantit le rôle opérateur ET charge l'Operator dans le contexte.
 *
 * C'est le cœur du cloisonnement : `ctx.operator.id` existant au niveau du
 * type, un router ne peut pas oublier son filtre par distraction. Tout accès
 * aux données d'un opérateur DOIT passer par `where: { operatorId: ctx.operator.id }`.
 */
export const operatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'operator' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }

  const operator = await ctx.db.operator.findUnique({
    where: { userId: ctx.user.id },
  })

  if (!operator) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: "Aucun profil opérateur associé à ce compte",
    })
  }

  return next({ ctx: { ...ctx, operator } })
})

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx })
})

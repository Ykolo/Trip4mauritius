'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from '@/lib/auth'

// `inferAdditionalFields` propage les `additionalFields` du serveur (role,
// locale) jusqu'au typage du client. Sans lui, `session.user.role` n'existe pas
// au niveau du type et chaque lecture du rôle demande un cast — c'est-à-dire
// une occasion de se tromper.
//
// L'import de `auth` est `type`-only : il est effacé à la compilation, donc ni
// Prisma ni le serveur Better Auth n'atterrissent dans le bundle client.
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
  plugins: [inferAdditionalFields<typeof auth>()],
})

export const { signIn, signUp, signOut, useSession } = authClient

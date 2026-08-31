'use client'

import { useCallback, useState } from 'react'
import { authClient } from '@/lib/auth-client'

/**
 * Utilisateur tel que le voit le client.
 *
 * La base ne stocke qu'un `name` (convention Better Auth) — pas de
 * `firstName` / `lastName`. Les découper ici recréerait un modèle parallèle
 * qui divergerait de la base au premier changement.
 *
 * `phone` est un `additionalField` : une valeur par défaut de formulaire, pas
 * le contact d'une réservation (celui-là vit sur `Booking.contactPhone`).
 */
export type AuthUser = {
  id: string
  name: string
  email: string
  image: string | null
  phone: string | null
  role: 'tourist' | 'operator' | 'admin'
}

const ROLES = ['tourist', 'operator', 'admin'] as const

/**
 * `role` est déclaré `type: 'string'` côté Better Auth : il arrive donc typé
 * `string`, pas en union. Le repli sur `tourist` reprend la règle du serveur
 * (`server/trpc/init.ts`) — une valeur inconnue ne doit jamais être
 * interprétée comme un privilège.
 */
function toRole(value: unknown): AuthUser['role'] {
  return (ROLES as readonly unknown[]).includes(value)
    ? (value as AuthUser['role'])
    : 'tourist'
}

/**
 * Session Better Auth, exposée sous la forme `{ data, isLoading }` attendue par
 * les pages.
 *
 * Ce n'est qu'un affichage : la session est aussi lue côté serveur dans le
 * contexte tRPC. Un client qui mentirait sur son rôle ne gagnerait qu'un menu
 * différent, aucune donnée.
 */
export function useAuth(): { data: AuthUser | null; isLoading: boolean } {
  const { data, isPending } = authClient.useSession()

  if (!data?.user) {
    return { data: null, isLoading: isPending }
  }

  const user = data.user as typeof data.user & { phone?: string | null }

  return {
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      phone: user.phone ?? null,
      role: toRole(user.role),
    },
    isLoading: isPending,
  }
}

export function useLogout() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(async (): Promise<void> => {
    setIsPending(true)
    try {
      await authClient.signOut()
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutateAsync, isPending }
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import type { Booking } from '@/types/cart'

/**
 * Réservations de l'utilisateur connecté.
 *
 * `enabled` n'est pas un confort : `booking.list` est une `protectedProcedure`,
 * l'appeler déconnecté remonterait une erreur UNAUTHORIZED que les pages
 * afficheraient à la place de leur invitation à se connecter. On attend donc
 * de savoir qu'il y a une session.
 */
export function useMyBookings(enabled = true): {
  data: Booking[]
  isLoading: boolean
} {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery({
    ...trpc.booking.list.queryOptions(),
    enabled,
  })

  return { data: data ?? [], isLoading: enabled && isLoading }
}

'use client'

import dynamic from 'next/dynamic'
import type { ActivityFull } from '@/types/activity'

// Chargé sans SSR : le panneau lit le panier (localStorage), qui n'existe pas
// côté serveur. Le rendre au serveur produirait un écart d'hydratation.
// Le reste de la page, lui, RESTE rendu côté serveur — c'est le contenu
// indexable, il ne doit pas passer derrière ce `dynamic`.
const BookingPanel = dynamic(
  () => import('@/components/ui/BookingPanel').then((mod) => mod.BookingPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 animate-pulse bg-muted/10 rounded-xl m-4" />
    ),
  },
)

export function PriceBreakdownWrapper({ activity }: { activity: ActivityFull }) {
  return <BookingPanel activity={activity} />
}

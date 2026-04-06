'use client'

import dynamic from 'next/dynamic'

const PriceBreakdown = dynamic(
  () => import('@/components/ui/PriceBreakdown').then(mod => mod.PriceBreakdown),
  { ssr: false, loading: () => <div className="h-40 animate-pulse bg-muted/10 rounded-xl" /> }
)

interface PriceBreakdownWrapperProps {
  priceHT: number
  maxParticipants: number
  selectedSlotId: string | null
  activityId: string
}

export function PriceBreakdownWrapper(props: PriceBreakdownWrapperProps) {
  return <PriceBreakdown {...props} />
}

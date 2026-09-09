'use client'

import { useState } from 'react'
import { CalendarX } from 'lucide-react'
import { PriceBreakdown } from '@/components/ui/PriceBreakdown'
import {
  PeriodSelector,
  type SelectedPeriod,
} from '@/components/ui/PeriodSelector'
import { SlotSelector } from '@/components/ui/SlotSelector'
import type { ActivityFull } from '@/types/activity'

// Panneau de réservation : choix du départ PUIS montants et ajout au panier.
//
// La page pré-sélectionnait jusqu'ici le premier créneau de la liste et
// n'offrait aucun moyen d'en changer : on pouvait mettre au panier un départ
// qu'on n'avait pas choisi. La sélection vit donc ici, et c'est elle qui
// alimente `PriceBreakdown`.
//
// L'aiguillage se fait sur `activity.bookingMode`, JAMAIS sur la présence de
// créneaux : une excursion dont tous les départs sont passés n'en a pas non
// plus, et se serait vu proposer un calendrier de location.

export function BookingPanel({ activity }: { activity: ActivityFull }) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod | null>(
    null,
  )

  if (activity.bookingMode === 'daily') {
    // Aucun état « rien de programmé » ici : une location est réservable en
    // permanence, c'est `dailyUnits` qui la borne, et la disponibilité ne se
    // tranche qu'à la réservation, sous verrou.
    return (
      <div className="p-4">
        <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
        <PriceBreakdown
          activity={activity}
          selectedSlot={null}
          selectedPeriod={selectedPeriod}
        />
      </div>
    )
  }

  const selectedSlot =
    activity.slots.find((slot) => slot.id === selectedSlotId) ?? null

  if (activity.slots.length === 0) {
    return (
      <div className="p-6 text-center">
        <CalendarX className="w-8 h-8 text-muted mx-auto mb-3" />
        <p className="text-ink font-semibold mb-1">Aucun départ programmé</p>
        <p className="text-muted text-sm">
          L&apos;opérateur n&apos;a pas encore publié de créneau pour cette
          activité.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <SlotSelector
        slots={activity.slots}
        selectedSlotId={selectedSlotId}
        onSelect={setSelectedSlotId}
      />
      <PriceBreakdown activity={activity} selectedSlot={selectedSlot} />
    </div>
  )
}

'use client'

import { Check } from 'lucide-react'
import type { ActivitySlot } from '@/types/activity'

interface SlotSelectorProps {
  slots: ActivitySlot[]
  selectedSlotId: string | null
  onSelect: (slotId: string) => void
}

/**
 * `date` arrive DÉJÀ en heure mauricienne (cf. `toActivitySlot`).
 *
 * La reconstruire en UTC puis la formater en UTC est ce qui l'empêche de
 * reculer d'un jour : `new Date('2026-09-12')` est minuit UTC, qu'un navigateur
 * à Los Angeles afficherait comme le 11. Ce composant lisait auparavant
 * `date.getDay()` et `getMonth()`, donc le fuseau du poste — même faute que
 * celle contre laquelle `lib/datetime.ts` existe, du côté client cette fois.
 */
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function SlotSelector({
  slots,
  selectedSlotId,
  onSelect,
}: SlotSelectorProps) {
  return (
    <section className="py-6">
      <h2 className="font-semibold text-xl text-ink mb-4">
        Choisissez votre départ
      </h2>

      <div className="space-y-0">
        {slots.map((slot) => {
          const isFull = slot.spotsLeft === 0
          const isSelected = selectedSlotId === slot.id

          return (
            <div
              key={slot.id}
              className={`flex items-center justify-between py-3 border-b border-muted/30 transition-colors ${
                isSelected ? 'bg-primary/10' : ''
              } ${isFull ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="text-ink font-medium min-w-[100px]">
                  {formatDate(slot.date)}
                </span>
                {/* La plage entière, pas la seule heure de départ : « 08:00 »
                    ne disait pas au touriste s'il serait rentré pour déjeuner.
                    `endTime` est dérivée de la durée de l'activité et vaut
                    `null` sur les fiches qui n'en ont pas. */}
                <span className="text-ink whitespace-nowrap">
                  {slot.endTime ? `${slot.time} – ${slot.endTime}` : slot.time}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-muted text-sm">
                  {isFull
                    ? 'Complet'
                    : `${slot.spotsLeft} place${slot.spotsLeft > 1 ? 's' : ''}`}
                </span>

                {isFull ? (
                  <span className="px-4 py-2 bg-muted/50 text-muted rounded-lg text-sm font-medium min-w-[100px] text-center">
                    Complet
                  </span>
                ) : isSelected ? (
                  <button
                    className="flex items-center justify-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium min-w-[100px] transition-colors"
                    disabled
                  >
                    Choisi <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSelect(slot.id)}
                    className="px-4 py-2 bg-surface border border-primary text-primary rounded-lg text-sm font-medium min-w-[100px] hover:bg-primary hover:text-white transition-colors active:scale-95"
                  >
                    Choisir
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

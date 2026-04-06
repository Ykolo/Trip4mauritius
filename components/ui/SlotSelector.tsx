'use client'

import { Check } from 'lucide-react'
import type { ActivitySlot } from '@/types/activity'

interface SlotSelectorProps {
  slots: ActivitySlot[]
  selectedSlotId: string | null
  onSelect: (slotId: string) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

export function SlotSelector({ slots, selectedSlotId, onSelect }: SlotSelectorProps) {
  return (
    <section className="py-6">
      <h2 className="font-semibold text-xl text-ink mb-4">Choose a date & time</h2>
      
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
              <div className="flex items-center gap-4 flex-1">
                <span className="text-ink font-medium min-w-[100px]">
                  {formatDate(slot.date)}
                </span>
                <span className="text-ink">{slot.time}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-muted text-sm">
                  {isFull ? 'No spots left' : `${slot.spotsLeft} spots left`}
                </span>
                
                {isFull ? (
                  <span className="px-4 py-2 bg-muted/50 text-muted rounded-lg text-sm font-medium min-w-[100px] text-center">
                    Full
                  </span>
                ) : isSelected ? (
                  <button
                    className="flex items-center justify-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium min-w-[100px] transition-colors"
                    disabled
                  >
                    Selected <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSelect(slot.id)}
                    className="px-4 py-2 bg-surface border border-primary text-primary rounded-lg text-sm font-medium min-w-[100px] hover:bg-primary hover:text-white transition-colors active:scale-95"
                  >
                    Select
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

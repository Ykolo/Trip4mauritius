'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Trash2, Minus, Plus, Calendar } from 'lucide-react'
import type { CartItem } from '@/types/cart'
import { useRemoveCartItem, useUpdateParticipants } from '@/lib/hooks/useCart'

interface CartItemRowProps {
  item: CartItem
  onRemove: (id: string) => void
  onUpdate: (id: string, participants: number) => void
}

function formatSlotDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

export function CartItemRow({ item, onRemove, onUpdate }: CartItemRowProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const removeItem = useRemoveCartItem()
  const updateParticipants = useUpdateParticipants()

  const handleRemove = async () => {
    if (!confirm('Remove this item from your cart?')) return

    setIsRemoving(true)
    // Optimistic removal
    onRemove(item.id)

    try {
      await removeItem.mutateAsync(item.id)
    } catch {
      // Revert would happen here in real app
      setIsRemoving(false)
    }
  }

  const handleUpdateParticipants = async (delta: number) => {
    const newCount = item.participants + delta
    if (newCount < 1 || newCount > 10) return

    onUpdate(item.id, newCount)

    try {
      await updateParticipants.mutateAsync({
        itemId: item.id,
        participants: newCount,
      })
    } catch {
      // Revert on error
      onUpdate(item.id, item.participants)
    }
  }

  const depositPerPerson = item.depositAmount / item.participants
  const totalDeposit = depositPerPerson * item.participants

  return (
    <div
      className={`rounded-2xl shadow-card bg-white p-4 flex gap-4 transition-opacity ${
        isRemoving ? 'opacity-50' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden">
        <Image
          src={item.activity.imageUrl}
          alt={item.activity.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-ink truncate">
          {item.activity.title}
        </h3>
        <p className="text-muted text-sm">{item.activity.operator}</p>
        <p className="text-sm text-muted flex items-center gap-1 mt-1">
          <Calendar className="w-4 h-4" />
          {formatSlotDate(item.slot.date)} at {item.slot.time}
        </p>
      </div>

      {/* Right side - controls */}
      <div className="flex flex-col items-end justify-between">
        {/* Remove button */}
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="p-2 text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
          aria-label="Remove item"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Participants stepper */}
        <div className="flex items-center gap-2 bg-surface rounded-xl px-2 py-1">
          <button
            onClick={() => handleUpdateParticipants(-1)}
            disabled={item.participants <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Decrease participants"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center font-semibold">
            {item.participants}
          </span>
          <button
            onClick={() => handleUpdateParticipants(1)}
            disabled={item.participants >= 10}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Increase participants"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Deposit amount */}
        <p className="text-accent font-semibold">
          Deposit: &euro;{totalDeposit.toFixed(0)}
        </p>
      </div>
    </div>
  )
}

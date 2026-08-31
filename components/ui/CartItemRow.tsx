'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Trash2, Minus, Plus, Calendar } from 'lucide-react'
import { computeBookingAmounts } from '@/lib/pricing'
import { useCartStore } from '@/lib/stores/cart'
import type { CartItem } from '@/types/cart'

// Le panier vivant dans le navigateur (Zustand), il n'y a plus de mutation à
// attendre ni d'état optimiste à annuler : la ligne agit directement sur le
// store et le rendu suit.

const MAX_PARTICIPANTS = 20

function formatSlotDate(dateStr: string): string {
  // `date` est déjà en heure mauricienne. La reconstruire en UTC puis la
  // formater en UTC évite que le fuseau du navigateur ne la décale d'un jour.
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function CartItemRow({ item }: { item: CartItem }) {
  const remove = useCartStore((s) => s.remove)
  const setParticipants = useCartStore((s) => s.setParticipants)

  const amounts = computeBookingAmounts(item.pricePerPerson, item.participants)

  const updateBy = (delta: number) => {
    const next = item.participants + delta
    if (next < 1 || next > MAX_PARTICIPANTS) return
    setParticipants(item.slotId, next)
  }

  return (
    <div className="rounded-2xl shadow-card bg-white p-4 flex gap-4">
      <Link
        href={`/activities/${item.activity.slug}`}
        className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden"
      >
        <Image
          src={item.activity.imageUrl}
          alt={item.activity.title}
          fill
          className="object-cover"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/activities/${item.activity.slug}`}
          className="font-semibold text-ink truncate block hover:text-primary transition-colors"
        >
          {item.activity.title}
        </Link>
        <p className="text-muted text-sm">{item.activity.operator}</p>
        <p className="text-sm text-muted flex items-center gap-1 mt-1">
          <Calendar className="w-4 h-4" />
          {formatSlotDate(item.slot.date)} à {item.slot.time}
        </p>
      </div>

      <div className="flex flex-col items-end justify-between">
        <button
          onClick={() => remove(item.slotId)}
          className="p-2 text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
          aria-label="Retirer du panier"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 bg-surface rounded-xl px-2 py-1">
          <button
            onClick={() => updateBy(-1)}
            disabled={item.participants <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Diminuer le nombre de participants"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center font-semibold">
            {item.participants}
          </span>
          <button
            onClick={() => updateBy(1)}
            disabled={item.participants >= MAX_PARTICIPANTS}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Augmenter le nombre de participants"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <p className="text-accent font-semibold">
          Acompte : &euro;{amounts.depositDue.toFixed(0)}
        </p>
      </div>
    </div>
  )
}

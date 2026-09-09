'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Trash2, Minus, Plus, Calendar } from 'lucide-react'
import { computeBookingAmounts } from '@/lib/pricing'
import { cartItemKey, cartItemUnits, useCartStore } from '@/lib/stores/cart'
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

  const key = cartItemKey(item)
  const units = cartItemUnits(item)

  // `cartItemUnits` décide de ce qui se multiplie : les participants sur un
  // créneau, les JOURS sur une location. Passer `item.participants` dans les
  // deux cas facturait le véhicule une fois par occupant.
  const amounts = computeBookingAmounts(item.pricePerUnit, units)

  const updateBy = (delta: number) => {
    const next = item.participants + delta
    if (next < 1 || next > MAX_PARTICIPANTS) return
    setParticipants(key, next)
  }

  // Une SEULE disposition, pas une variante mobile et une variante bureau.
  //
  // L'ancienne rangeait vignette, texte et actions sur trois colonnes côte à
  // côte. Sur un écran de 375 px il restait 95 px au titre une fois la vignette
  // (80), le compteur (120) et les espacements retirés — illisible. Empiler les
  // actions SOUS le texte tient aussi bien à 343 qu'à 1280 px, et évite d'avoir
  // deux arbres à maintenir en parallèle.
  return (
    <div className="rounded-2xl shadow-card bg-white p-4">
      <div className="flex gap-3 sm:gap-4">
        <Link
          href={`/activities/${item.activity.slug}`}
          className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden"
        >
          <Image
            src={item.activity.imageUrl}
            alt={item.activity.title}
            fill
            sizes="80px"
            className="object-cover"
          />
        </Link>

        {/* `min-w-0` obligatoire : le titre porte `truncate`, donc
            `white-space: nowrap`. Sans cette ligne, l'élément flexible refuse
            de se réduire sous la largeur du titre entier et pousse la carte
            hors de l'écran au lieu de couper le texte. */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/activities/${item.activity.slug}`}
            className="font-semibold text-ink truncate block hover:text-primary transition-colors"
          >
            {item.activity.title}
          </Link>
          <p className="text-muted text-sm truncate">{item.activity.operator}</p>
          <p className="text-sm text-muted flex items-center gap-1 mt-1">
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {item.mode === 'daily'
                ? `Du ${formatSlotDate(item.period.startDate)} au ${formatSlotDate(item.period.endDate)} · ${units} jour${units > 1 ? 's' : ''}`
                : `${formatSlotDate(item.slot.date)} à ${item.slot.time}${
                    item.slot.endTime ? ` – ${item.slot.endTime}` : ''
                  }`}
            </span>
          </p>
        </div>

        <button
          onClick={() => remove(key)}
          className="self-start -mr-1 p-2 text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 shrink-0"
          aria-label="Retirer du panier"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 sm:gap-2 bg-surface rounded-xl px-2 py-1 shrink-0">
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

        <p className="text-accent font-semibold text-right truncate">
          Acompte&nbsp;: &euro;{amounts.depositDue.toFixed(0)}
        </p>
      </div>
    </div>
  )
}

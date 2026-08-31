'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { computeBookingAmounts } from '@/lib/pricing'
import { useCartStore } from '@/lib/stores/cart'
import type { ActivityFull, ActivitySlot } from '@/types/activity'

interface PriceBreakdownProps {
  activity: ActivityFull
  selectedSlot: ActivitySlot | null
}

export function PriceBreakdown({
  activity,
  selectedSlot,
}: PriceBreakdownProps) {
  const router = useRouter()
  const addToCart = useCartStore((s) => s.add)
  const [participants, setParticipants] = useState(1)
  const [showToast, setShowToast] = useState(false)

  // Le plafond est le PLUS CONTRAIGNANT des deux : la capacité de l'activité et
  // ce qu'il reste sur ce départ précis. N'afficher que `maxParticipants`
  // laisserait demander 8 places sur un créneau qui n'en a plus que 2 — le
  // serveur refuserait, mais seulement après le tunnel de commande.
  const maxSelectable = Math.min(
    activity.maxParticipants,
    selectedSlot?.spotsLeft ?? activity.maxParticipants,
  )

  // Mêmes montants que ceux que le serveur calculera : c'est la fonction de
  // RULE-001 qui est appelée ici, pas une seconde implémentation des 20 %.
  const amounts = useMemo(
    () => computeBookingAmounts(activity.priceHT, participants),
    [activity.priceHT, participants],
  )

  const canDecrease = participants > 1
  const canIncrease = participants < maxSelectable

  const handleAddToCart = () => {
    if (!selectedSlot) return

    addToCart({
      slotId: selectedSlot.id,
      activityId: activity.id,
      activity: {
        slug: activity.slug,
        title: activity.title,
        imageUrl: activity.imageUrl,
        operator: activity.operator.name,
      },
      slot: { date: selectedSlot.date, time: selectedSlot.time },
      participants,
      pricePerPerson: activity.priceHT,
    })

    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const priceContent = (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-ink font-semibold">Prix total</span>
        <span className="text-ink font-semibold">
          {activity.priceHT}€ / pers.
        </span>
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-muted text-sm font-body">
          Acompte à régler aujourd&apos;hui (20%) :
        </span>
        <span className="text-primary font-display font-bold text-2xl">
          {amounts.depositDue.toFixed(0)}€
        </span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <span className="text-muted text-sm font-body">
          Reste à payer sur place :
        </span>
        <span className="text-muted text-sm font-body">
          {amounts.balanceDueOnSite.toFixed(0)}€
        </span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className="text-ink font-medium font-body">Participants</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => canDecrease && setParticipants((p) => p - 1)}
            disabled={!canDecrease}
            className={`w-10 h-10 rounded-[0.8rem] border flex items-center justify-center transition-all ${
              canDecrease
                ? 'border-muted/30 text-ink hover:bg-base hover:border-muted/50 active:scale-95'
                : 'border-muted/20 text-muted/50 cursor-not-allowed bg-base'
            }`}
            aria-label="Diminuer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-ink font-bold text-lg min-w-[2rem] text-center font-body">
            {participants}
          </span>
          <button
            onClick={() => canIncrease && setParticipants((p) => p + 1)}
            disabled={!canIncrease}
            className={`w-10 h-10 rounded-[0.8rem] border flex items-center justify-center transition-all ${
              canIncrease
                ? 'border-muted/30 text-ink hover:bg-base hover:border-muted/50 active:scale-95'
                : 'border-muted/20 text-muted/50 cursor-not-allowed bg-base'
            }`}
            aria-label="Augmenter"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={!selectedSlot}
        className={`w-full h-14 rounded-xl text-base font-semibold font-body flex items-center justify-center gap-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          selectedSlot
            ? 'bg-ink text-white hover:bg-ink/90 shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-muted/20 text-muted cursor-not-allowed'
        }`}
      >
        <ShoppingCart className="w-5 h-5" />
        Ajouter au panier
      </button>

      {!selectedSlot && (
        <p className="text-center text-muted text-xs mt-3 font-body">
          Veuillez sélectionner un créneau disponible
        </p>
      )}

      {selectedSlot && selectedSlot.spotsLeft <= 3 && (
        <p className="text-center text-accent text-xs mt-3 font-body font-medium">
          Plus que {selectedSlot.spotsLeft} place(s) sur ce départ
        </p>
      )}
    </>
  )

  return (
    <>
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-ink shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.2)] py-2.5 px-4 z-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-primary font-display font-bold text-xl leading-none mb-0.5">
              {amounts.depositDue.toFixed(0)}€
            </div>
            <div className="text-white/50 text-[10px] font-body font-medium uppercase tracking-widest">
              Acompte ({participants} pers.)
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 p-0.5 rounded-lg">
            <button
              onClick={() => canDecrease && setParticipants((p) => p - 1)}
              disabled={!canDecrease}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                canDecrease
                  ? 'bg-white shadow-sm text-primary hover:text-primary-light active:scale-95'
                  : 'text-white/30 cursor-not-allowed'
              }`}
              aria-label="Diminuer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold min-w-[24px] text-center text-white text-sm">
              {participants}
            </span>
            <button
              onClick={() => canIncrease && setParticipants((p) => p + 1)}
              disabled={!canIncrease}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                canIncrease
                  ? 'bg-white shadow-sm text-primary hover:text-primary-light active:scale-95'
                  : 'text-white/30 cursor-not-allowed'
              }`}
              aria-label="Augmenter"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!selectedSlot}
            className={`flex-1 h-10 rounded-lg font-body text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              selectedSlot
                ? 'bg-primary text-white hover:bg-primary-light'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Ajouter au panier
          </button>
        </div>
      </div>

      {/* Desktop view is handled by page wrapper */}
      <div className="hidden md:block">{priceContent}</div>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-ink border border-white/10 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 font-body text-sm font-medium"
          >
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            Ajouté au panier
            <button
              onClick={() => router.push('/cart')}
              className="underline underline-offset-2 hover:text-primary transition-colors"
            >
              Voir le panier
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

'use client'

import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PriceBreakdownProps {
  priceHT: number
  maxParticipants: number
  selectedSlotId: string | null
  activityId: string
}

export function PriceBreakdown({
  priceHT,
  maxParticipants,
  selectedSlotId,
  activityId
}: PriceBreakdownProps) {
  const [participants, setParticipants] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const totalPrice = priceHT * participants
  const deposit = totalPrice * 0.2
  const balance = totalPrice * 0.8

  const canDecrease = participants > 1
  const canIncrease = participants < maxParticipants

  const handleAddToCart = async () => {
    // Dans notre POC, selectedSlotId est passé en dur pour simuler une réservation valide
    if (!selectedSlotId) return

    setIsAdding(true)
    
    // Simuler un appel réseau
    await new Promise(resolve => setTimeout(resolve, 800))
    
    console.log('Ajout au panier :', { activityId, slotId: selectedSlotId, participants })
    
    setIsAdding(false)
    setShowToast(true)
    
    setTimeout(() => setShowToast(false), 3000)
  }

  const priceContent = (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-ink font-semibold">Prix total</span>
        <span className="text-ink font-semibold">{priceHT}€ / pers.</span>
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-muted text-sm font-body">Acompte à régler aujourd'hui (20%) :</span>
        <span className="text-primary font-display font-bold text-2xl">{deposit.toFixed(0)}€</span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <span className="text-muted text-sm font-body">Reste à payer sur place :</span>
        <span className="text-muted text-sm font-body">{balance.toFixed(0)}€</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className="text-ink font-medium font-body">Participants</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => canDecrease && setParticipants(p => p - 1)}
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
            onClick={() => canIncrease && setParticipants(p => p + 1)}
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

      {/* SHADCN Style CTA Button */}
      <button
        onClick={handleAddToCart}
        disabled={!selectedSlotId || isAdding}
        className={`w-full h-14 rounded-xl text-base font-semibold font-body flex items-center justify-center gap-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          selectedSlotId
            ? 'bg-ink text-white hover:bg-ink/90 shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-muted/20 text-muted cursor-not-allowed'
        }`}
      >
        {isAdding ? (
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Traitement...
          </span>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" />
            Ajouter au panier
          </>
        )}
      </button>

      {!selectedSlotId && (
        <p className="text-center text-muted text-xs mt-3 font-body">
          Veuillez sélectionner un créneau disponible
        </p>
      )}
    </>
  )

  return (
    <>
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-ink shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.2)] py-2.5 px-4 z-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-primary font-display font-bold text-xl leading-none mb-0.5">{deposit.toFixed(0)}€</div>
            <div className="text-white/50 text-[10px] font-body font-medium uppercase tracking-widest">
              Acompte ({participants} pers.)
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-white/10 p-0.5 rounded-lg">
            <button
              onClick={() => canDecrease && setParticipants(p => p - 1)}
              disabled={!canDecrease}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                canDecrease ? 'bg-white shadow-sm text-primary hover:text-primary-light active:scale-95' : 'text-white/30 cursor-not-allowed'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold min-w-[24px] text-center text-white text-sm">{participants}</span>
            <button
              onClick={() => canIncrease && setParticipants(p => p + 1)}
              disabled={!canIncrease}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                canIncrease ? 'bg-white shadow-sm text-primary hover:text-primary-light active:scale-95' : 'text-white/30 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!selectedSlotId || isAdding}
            className={`flex-1 h-10 rounded-lg font-body text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              selectedSlotId
                ? 'bg-primary text-white hover:bg-primary-light'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {isAdding ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                En cours...
              </span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Ajouter au panier
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desktop view is handled by page wrapper */}
      <div className="hidden md:block">
        {priceContent}
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-ink border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 font-body text-sm font-medium"
          >
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            Validé : Ajouté au panier avec succès !
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

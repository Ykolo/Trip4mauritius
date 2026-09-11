'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { computeBookingAmounts } from '@/lib/pricing'
import { cartItemUnits, useCartStore } from '@/lib/stores/cart'
import {
  DEFAULT_PICKUP_TIME,
  DEFAULT_RETURN_TIME,
  type SelectedPeriod,
} from '@/components/ui/PeriodSelector'
import type { ActivityFull, ActivitySlot } from '@/types/activity'
import type { CartItem } from '@/types/cart'

interface PriceBreakdownProps {
  activity: ActivityFull
  /** Renseigné en mode créneau uniquement. */
  selectedSlot: ActivitySlot | null
  /** Renseigné en mode journée uniquement. */
  selectedPeriod?: SelectedPeriod | null
}

export function PriceBreakdown({
  activity,
  selectedSlot,
  selectedPeriod = null,
}: PriceBreakdownProps) {
  const router = useRouter()
  const addToCart = useCartStore((s) => s.add)
  const [participants, setParticipants] = useState(1)
  const [showToast, setShowToast] = useState(false)
  // La confirmation part dans un portail, et un portail ne peut pas être créé
  // au rendu serveur — `document` n'y existe pas. Ce drapeau retarde sa
  // création au premier rendu client. Il ne peut pas être remplacé par
  // `showToast &&` : c'est `AnimatePresence` qui doit SURVIVRE au retrait de
  // son enfant pour en animer la sortie, donc le portail aussi.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDaily = activity.bookingMode === 'daily'

  // Le plafond est le PLUS CONTRAIGNANT des deux : la capacité de l'activité et
  // ce qu'il reste sur ce départ précis. N'afficher que `maxParticipants`
  // laisserait demander 8 places sur un créneau qui n'en a plus que 2 — le
  // serveur refuserait, mais seulement après le tunnel de commande.
  //
  // En mode journée il n'y a pas de départ : le seul plafond est le nombre de
  // places DU VÉHICULE. `dailyUnits` n'a rien à faire ici — c'est un stock de
  // véhicules, pas de sièges, et il ne se vérifie que sous verrou au moment de
  // réserver.
  const maxSelectable = isDaily
    ? activity.maxParticipants
    : Math.min(
        activity.maxParticipants,
        selectedSlot?.spotsLeft ?? activity.maxParticipants,
      )

  // La ligne de panier que produirait un clic sur « Ajouter » — `null` tant que
  // la sélection est incomplète. Elle est construite ICI plutôt qu'au moment du
  // clic pour que l'affichage des montants et ce qui part au panier soient
  // littéralement la même chose : deux constructions séparées auraient fini par
  // afficher un prix et en réserver un autre.
  const pendingItem = useMemo<CartItem | null>(() => {
    const common = {
      activityId: activity.id,
      activity: {
        slug: activity.slug,
        title: activity.title,
        imageUrl: activity.imageUrl,
        operator: activity.operator.name,
      },
      participants,
      // Le prix en base est celui de l'UNITÉ facturée : par personne sur un
      // créneau, par jour sur une location. Une seule colonne, deux lectures.
      pricePerUnit: activity.priceHT,
    }

    if (isDaily) {
      if (!selectedPeriod) return null
      return {
        ...common,
        mode: 'daily',
        period: {
          startDate: selectedPeriod.startDate,
          startTime: DEFAULT_PICKUP_TIME,
          endDate: selectedPeriod.endDate,
          endTime: DEFAULT_RETURN_TIME,
        },
      }
    }

    if (!selectedSlot) return null
    return {
      ...common,
      mode: 'slot',
      slotId: selectedSlot.id,
      slot: {
        date: selectedSlot.date,
        time: selectedSlot.time,
        endTime: selectedSlot.endTime,
      },
    }
  }, [activity, participants, isDaily, selectedPeriod, selectedSlot])

  const ready = pendingItem !== null

  // Nombre de JOURS facturés en mode journée, de personnes en mode créneau —
  // par la même fonction que le panier et, en dessous, que le serveur.
  const units = pendingItem ? cartItemUnits(pendingItem) : participants

  // Mêmes montants que ceux que le serveur calculera : c'est la fonction de
  // RULE-001 qui est appelée ici, pas une seconde implémentation des 20 %.
  const amounts = useMemo(
    () => computeBookingAmounts(activity.priceHT, isDaily ? units : participants),
    [activity.priceHT, isDaily, units, participants],
  )

  const canDecrease = participants > 1
  const canIncrease = participants < maxSelectable

  const handleAddToCart = () => {
    if (!pendingItem) return

    addToCart(pendingItem)

    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const priceContent = (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-ink font-semibold">Prix</span>
        {/* En mode journée le prix est FORFAITAIRE : c'est celui du véhicule,
            pas celui d'un siège. Afficher « / pers. » ici laissait croire
            qu'une Jeep à quatre coûte quatre fois plus cher. */}
        <span className="text-ink font-semibold">
          {activity.priceHT}€ {isDaily ? '/ jour' : '/ pers.'}
        </span>
      </div>

      {isDaily && ready && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted text-sm font-body">
            {units} jour{units > 1 ? 's' : ''} facturé{units > 1 ? 's' : ''}
          </span>
          <span className="text-ink text-sm font-body">
            {amounts.totalPrice.toFixed(0)}€
          </span>
        </div>
      )}

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
        {/* En mode journée ce compteur ne pèse PAS sur le prix : il sert à
            prévenir le loueur du nombre d'occupants et à rester sous le nombre
            de places du véhicule. Le libeller « Participants » comme sur une
            excursion laissait penser qu'on achetait des places. */}
        <span className="text-ink font-medium font-body">
          {isDaily ? 'Occupants' : 'Participants'}
        </span>
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
        disabled={!ready}
        className={`w-full h-14 rounded-xl text-base font-semibold font-body flex items-center justify-center gap-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          ready
            ? 'bg-ink text-white hover:bg-ink/90 shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-muted/20 text-muted cursor-not-allowed'
        }`}
      >
        <ShoppingCart className="w-5 h-5" />
        Ajouter au panier
      </button>

      {!ready && (
        <p className="text-center text-muted text-xs mt-3 font-body">
          {isDaily
            ? 'Veuillez choisir vos dates de retrait et de restitution'
            : 'Veuillez sélectionner un créneau disponible'}
        </p>
      )}

      {!isDaily && selectedSlot && selectedSlot.spotsLeft <= 3 && (
        <p className="text-center text-accent text-xs mt-3 font-body font-medium">
          Plus que {selectedSlot.spotsLeft} place(s) sur ce départ
        </p>
      )}

      {/* La disponibilité d'une location ne se sait qu'au moment de réserver :
          elle dépend des périodes que d'autres auront prises entre-temps, et se
          vérifie sous verrou. Promettre ici « disponible » serait un mensonge
          que rien ne garantit trente secondes plus tard. */}
      {isDaily && ready && (
        <p className="text-center text-muted text-xs mt-3 font-body">
          Disponibilité confirmée à la validation de la réservation.
        </p>
      )}
    </>
  )

  return (
    <>
      {/* `z-[60]`, au-dessus du z-50 général, et ce n'est pas gratuit.
          Le pied de page ouvre ses menus « langue » et « devise » vers le haut
          avec un `z-50` local. À z-index ÉGAL, c'est l'ordre du DOM qui
          tranche — et le pied de page est rendu APRÈS le contenu de la page :
          ses menus passaient donc devant ce bandeau, qui est pourtant la seule
          barre d'action de l'écran. Le monter d'un cran le sort définitivement
          de cette égalité. */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-ink shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.2)] py-2.5 px-4 z-[60]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-primary font-display font-bold text-xl leading-none mb-0.5">
              {amounts.depositDue.toFixed(0)}€
            </div>
            {/* La barre mobile est un SECOND rendu du même panneau : ce libellé
                doit suivre le mode comme celui du bureau, sinon un des deux
                affiche « 4 pers. » sur un prix qui n'en dépend pas. */}
            <div className="text-white/50 text-[10px] font-body font-medium uppercase tracking-widest">
              Acompte{' '}
              {isDaily
                ? ready
                  ? `(${units} jour${units > 1 ? 's' : ''})`
                  : '(dates à choisir)'
                : `(${participants} pers.)`}
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
            disabled={!ready}
            className={`flex-1 h-10 rounded-lg font-body text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              ready
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

      {/* La confirmation est rendue DANS `document.body`, par un portail, et
          non à sa place dans l'arbre. Sans cela son `z-[70]` ne vaut rien.

          `PriceBreakdown` est rendu à l'intérieur de la colonne de réservation,
          qui porte `position: sticky` — et **sticky crée un contexte
          d'empilement**, au même titre que `fixed`, sans avoir besoin d'un
          `z-index`. Tout `z-index` posé en dessous est donc comparé entre
          frères de cette colonne, jamais au reste de la page : la colonne
          entière se compare, elle, comme un `z-index: 0`. Le pied de page vient
          APRÈS elle dans le DOM, à égalité de niveau — c'est l'ordre du
          document qui tranche, et le logo passait devant la confirmation.
          Mesuré : `elementsFromPoint` au centre du recouvrement rendait
          `IMG|Trip4mauritius` en tête, la confirmation seulement en second ;
          en neutralisant le seul `position: sticky`, l'ordre s'inverse.

          Le symptôme est le même que celui déjà corrigé plus bas à coups de
          décalage vertical (`bottom-36`) — ce n'était pas le bon remède, la
          confirmation passait sous les barres pour la même raison. Les
          décalages restent : ils ne servent plus à passer devant, mais à ne
          pas RECOUVRIR le bandeau d'acompte et la navigation, dont on veut
          continuer à lire les commandes.

          Portail au `body` et pas à un conteneur dédié : `body` est le seul
          ancêtre dont on sait qu'aucun `transform`, `filter` ou `sticky` ne
          viendra un jour l'enfermer à son tour. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                /* Le décalage dégage DEUX barres empilées sur mobile : la
                   navigation (0 → 64 px) et le bandeau d'acompte juste
                   au-dessus, mesuré à 124 px de haut. D'où 144 px — 128 px la
                   posaient à 4 px du bandeau, ce qui se lit comme un
                   chevauchement. Sur grand écran il n'y a que la navigation,
                   qui n'est pas réservée au mobile : 96 px la dégagent. */
                className="fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 bg-ink border border-white/10 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[70] font-body text-sm font-medium"
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
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

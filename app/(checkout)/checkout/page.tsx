'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useCartHydrated, useCartStore, useCartTotals } from '@/lib/stores/cart'
import { useTRPC } from '@/lib/trpc/client'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

// Le tunnel exige un compte : `Booking.userId` n'est pas nullable, une
// réservation appartient forcément à quelqu'un. Le parcours « invité » qui
// figurait ici ne pouvait donc rien produire. `/checkout` est protégé par
// proxy.ts, cet écran n'est qu'un filet si le cookie expire en cours de route.

type Step = 1 | 2 | 3

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'Coordonnées' },
    { num: 2, label: 'Récapitulatif' },
    { num: 3, label: 'Confirmée' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
              currentStep > step.num
                ? 'bg-green-500 text-white'
                : currentStep === step.num
                  ? 'bg-primary text-white'
                  : 'bg-muted/20 text-muted'
            }`}
          >
            {currentStep > step.num ? (
              <Check className="w-5 h-5" />
            ) : (
              step.num
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 h-1 mx-2 rounded transition-colors ${
                currentStep > step.num ? 'bg-green-500' : 'bg-muted/20'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function CheckoutPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: user, isLoading: authLoading } = useAuth()
  const cart = useCartTotals()
  const hydrated = useCartHydrated()
  const clearCart = useCartStore((s) => s.clear)

  const [step, setStep] = useState<Step>(1)
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [bookingRef, setBookingRef] = useState('')
  const [confirmedDeposit, setConfirmedDeposit] = useState(0)

  // Le numéro du profil ne sert que de valeur par défaut : l'utilisateur reste
  // libre de donner un autre contact pour ce voyage-ci.
  useEffect(() => {
    if (user?.phone) setPhone(user.phone)
  }, [user?.phone])

  const createBooking = useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: (result) => {
        setBookingRef(result.bookingRef)
        setConfirmedDeposit(result.totalDeposit)
        // Le panier n'a plus lieu d'être : ses lignes sont devenues des
        // réservations. Le vider APRÈS le succès seulement — sur un échec, on
        // veut que l'utilisateur retrouve sa sélection intacte.
        clearCart()
        queryClient.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
        setStep(3)
      },
    }),
  )

  const handleContinue = () => {
    if (phone.trim().length < 6) {
      setPhoneError('Merci d’indiquer un numéro où l’opérateur peut vous joindre.')
      return
    }
    setPhoneError(null)
    setStep(2)
  }

  const handleConfirm = () => {
    createBooking.mutate({
      // Seuls le créneau et le nombre de participants partent : aucun montant.
      // Le serveur relit le prix en base et recalcule tout.
      items: cart.items.map((item) => ({
        slotId: item.slotId,
        participants: item.participants,
      })),
      contactPhone: phone.trim(),
    })
  }

  if (authLoading || !hydrated) {
    return (
      <div className="min-h-screen bg-base py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card p-8 text-center max-w-sm">
          <h1 className="text-xl font-semibold text-ink mb-2">
            Connectez-vous pour réserver
          </h1>
          <p className="text-muted text-sm mb-6">
            Une réservation est rattachée à votre compte : c&apos;est ce qui vous
            permet de la retrouver et de l&apos;annuler.
          </p>
          <Link
            href="/login?redirect=/checkout"
            className="inline-block w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform"
          >
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  // Panier vide et réservation non encore passée : il n'y a rien à valider.
  if (cart.items.length === 0 && step !== 3) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-xl font-semibold text-ink mb-2">
            Votre panier est vide
          </h1>
          <Link
            href="/activities"
            className="inline-block mt-4 bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform"
          >
            Parcourir les activités
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink text-center mb-6">
          Réservation
        </h1>

        <StepIndicator currentStep={step} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-card p-6"
            >
              <h2 className="text-lg font-semibold text-ink mb-4">
                Vos coordonnées
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Nom
                  </label>
                  {/* Nom et email viennent de la session : les ressaisir
                      ouvrirait la porte à une réservation au nom d'un autre, et
                      créerait un second jeu de coordonnées à maintenir. */}
                  <input
                    type="text"
                    value={user.name}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-surface/50 text-muted cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-surface/50 text-muted cursor-not-allowed"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-ink mb-1"
                  >
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+230 5xxx xxxx"
                    className={`w-full px-4 py-3 rounded-xl border ${
                      phoneError ? 'border-red-500' : 'border-surface'
                    } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                    required
                  />
                  {phoneError ? (
                    <p className="text-red-500 text-xs mt-1">{phoneError}</p>
                  ) : (
                    <p className="text-xs text-muted mt-1">
                      L&apos;opérateur l&apos;utilisera pour vous joindre en cas
                      de météo défavorable ou de changement d&apos;horaire.
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleContinue}
                className="w-full mt-6 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform"
              >
                Continuer
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                <button
                  onClick={() => setOrderSummaryOpen(!orderSummaryOpen)}
                  className="w-full px-6 py-4 flex items-center justify-between"
                >
                  <span className="font-semibold text-ink">
                    {cart.itemCount} activité(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-accent font-bold">
                      &euro;{cart.totalDeposit.toFixed(0)}
                    </span>
                    {orderSummaryOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {orderSummaryOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-3">
                        {cart.items.map((item) => (
                          <div key={item.slotId} className="flex gap-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={item.activity.imageUrl}
                                alt={item.activity.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink truncate">
                                {item.activity.title}
                              </p>
                              <p className="text-xs text-muted">
                                {item.slot.date} à {item.slot.time} ·{' '}
                                {item.participants} pers.
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="bg-white rounded-2xl shadow-card p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">
                  Paiement
                </h2>

                {/* Stripe n'est pas branché : le dire franchement plutôt que
                    d'afficher un faux formulaire de carte. La réservation est
                    ferme, l'acompte se règle auprès de l'opérateur. */}
                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-medium mb-1">
                      Le paiement en ligne n&apos;est pas encore disponible.
                    </p>
                    <p>
                      Votre réservation sera confirmée immédiatement et les
                      places vous seront attribuées. L&apos;acompte sera à régler
                      directement auprès de l&apos;opérateur.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted">Acompte (20 %)</span>
                    <span className="text-accent font-bold text-lg">
                      &euro;{cart.totalDeposit.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Solde sur place</span>
                    <span className="text-muted">
                      &euro;{cart.totalOnSite.toFixed(0)}
                    </span>
                  </div>
                </div>

                {createBooking.error && (
                  <div className="mt-6 border border-red-200 bg-red-50 rounded-2xl p-4">
                    <p className="text-sm text-red-800">
                      {createBooking.error.message}
                    </p>
                    <Link
                      href="/cart"
                      className="text-sm text-red-800 underline underline-offset-2 mt-2 inline-block"
                    >
                      Modifier mon panier
                    </Link>
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={createBooking.isPending}
                  className="w-full mt-6 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createBooking.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Réservation en cours...
                    </>
                  ) : (
                    'Confirmer ma réservation'
                  )}
                </button>

                <button
                  onClick={() => setStep(1)}
                  disabled={createBooking.isPending}
                  className="w-full mt-3 text-muted text-sm py-2 hover:text-ink transition-colors disabled:opacity-50"
                >
                  Revenir aux coordonnées
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-card p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>

              <h2 className="text-2xl font-display text-ink mb-2">
                Réservation confirmée !
              </h2>
              <p className="text-muted mb-6">
                Votre aventure à l&apos;île Maurice vous attend
              </p>

              <div className="bg-base rounded-xl px-6 py-4 inline-block mb-6">
                <p className="text-xs text-muted mb-1">Référence</p>
                <p className="font-mono text-xl font-bold text-ink">
                  {bookingRef}
                </p>
              </div>

              <div className="border-t border-surface pt-6 mb-6 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Acompte à régler</span>
                  <span className="text-accent font-semibold">
                    &euro;{confirmedDeposit.toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/bookings"
                  className="flex-1 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform text-center"
                >
                  Voir mes réservations
                </Link>
                <Link
                  href="/activities"
                  className="flex-1 bg-surface text-ink font-semibold py-4 rounded-2xl active:scale-95 transition-transform text-center"
                >
                  Continuer à explorer
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

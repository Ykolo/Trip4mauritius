'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Banknote, Landmark } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'

// Relevé en LECTURE SEULE, et il le restera un moment.
//
// Maurice ne figure pas dans les pays supportés par Stripe : Stripe Connect est
// probablement inutilisable pour reverser les opérateurs mauriciens. Tant que
// ce point n'est pas tranché (PSP local type MIPS, ou virements hors
// plateforme), afficher un bouton « Retirer mes fonds » promettrait un
// mécanisme qui n'existe pas.

export default function OperatorWalletPage() {
  const trpc = useTRPC()
  const { data: stats, isLoading } = useQuery(trpc.operator.stats.queryOptions())

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">Relevé</h1>
        <p className="text-muted mt-1">
          Ce que la plateforme a encaissé pour vous, et ce qu&apos;il vous reste
          à percevoir sur place.
        </p>
      </header>

      {isLoading || !stats ? (
        <div className="space-y-4">
          <div className="h-32 bg-white rounded-2xl shadow-card animate-pulse" />
          <div className="h-32 bg-white rounded-2xl shadow-card animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Landmark className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted mb-1">
                  Acomptes encaissés par la plateforme
                </p>
                <p className="font-bold text-3xl text-ink">
                  {formatEUR(stats.platformFee)}
                </p>
                <p className="text-xs text-muted mt-2">
                  20 % du montant des réservations confirmées.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted mb-1">
                  Solde à encaisser sur place
                </p>
                <p className="font-bold text-3xl text-ink">
                  {formatEUR(stats.totalRevenue - stats.platformFee)}
                </p>
                <p className="text-xs text-muted mt-2">
                  Perçu directement auprès du client le jour du départ.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6">
            <p className="text-sm text-muted mb-1">
              Chiffre d&apos;affaires total
            </p>
            <p className="font-bold text-2xl text-ink">
              {formatEUR(stats.totalRevenue)}
            </p>
            <p className="text-xs text-muted mt-1">
              {stats.totalBookings} réservation(s) confirmée(s).
            </p>
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Reversements non disponibles</p>
              <p>
                Le paiement en ligne n&apos;est pas encore branché : les acomptes
                affichés ici sont comptables, pas encaissés. Le circuit de
                reversement reste à définir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

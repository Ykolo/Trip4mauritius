'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import type { BookingStatus } from '@/types/cart'

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
  expired: 'bg-muted/20 text-muted',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmée',
  pending_payment: 'En attente',
  completed: 'Terminée',
  cancelled: 'Annulée',
  expired: 'Expirée',
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function OperatorBookingsPage() {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    ...trpc.operator.listBookings.queryOptions({ page }),
    // Sans ça, changer de page vide le tableau puis le repeint : la hauteur
    // saute et la position de défilement se perd.
    placeholderData: keepPreviousData,
  })

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">
          Gestion des réservations
        </h1>
        <p className="text-muted mt-1">
          Vos passagers, leurs coordonnées et le solde à encaisser sur place.
        </p>
      </header>

      {isLoading && !data ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-base rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !data || data.bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-12 text-center">
          <p className="text-ink font-body font-bold mb-2">
            Aucune réservation pour l&apos;instant
          </p>
          <p className="text-muted font-body text-sm">
            Vos réservations apparaîtront ici dès qu&apos;un touriste réservera
            l&apos;un de vos départs.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile : cartes */}
          <div className="space-y-4 md:hidden">
            {data.bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {booking.touristName}
                    </p>
                    <p className="text-sm text-muted truncate">
                      {booking.activityTitle}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted">
                  <span>
                    {booking.date} — {booking.time}
                  </span>
                  <span>{booking.participants} pax</span>
                  {booking.contactPhone && (
                    <a
                      href={`tel:${booking.contactPhone}`}
                      className="flex items-center gap-1.5 text-primary col-span-2"
                    >
                      <Phone className="w-4 h-4" />
                      {booking.contactPhone}
                    </a>
                  )}
                </div>
                <div className="flex justify-between pt-2 border-t border-surface text-sm">
                  <span className="text-muted">Solde sur place</span>
                  <span className="font-semibold text-ink">
                    {formatEUR(booking.balanceDueOnSite)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop : tableau. `overflow-x-auto` sur le conteneur, jamais sur
              la page — un tableau large ne doit pas faire défiler tout l'écran. */}
          <div className="hidden md:block bg-white rounded-2xl shadow-card border border-muted/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-base">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted">
                      Départ
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted">
                      Activité
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted">
                      Pax
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted">
                      Solde sur place
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {data.bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-base transition-colors">
                      <td className="px-4 py-3 text-sm text-ink whitespace-nowrap">
                        <div>{booking.date}</div>
                        <div className="text-muted text-xs">{booking.time}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">
                        <div>{booking.touristName}</div>
                        {booking.contactPhone && (
                          <a
                            href={`tel:${booking.contactPhone}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {booking.contactPhone}
                          </a>
                        )}
                        <div className="text-xs font-mono text-muted">
                          {booking.bookingRef}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink max-w-[220px] truncate">
                        {booking.activityTitle}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink text-center">
                        {booking.participants}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-ink text-right whitespace-nowrap">
                        {formatEUR(booking.balanceDueOnSite)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Page précédente"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-sm text-muted">
                Page {page} sur {data.pages} · {data.total} réservations
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="p-2 rounded-lg bg-white border border-muted/10 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Page suivante"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

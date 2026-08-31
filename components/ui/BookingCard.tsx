'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, Loader2, Phone } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { Booking, BookingStatus } from '@/types/cart'

// Carte de réservation partagée par /bookings et /account.
//
// Les deux pages en affichaient chacune leur copie : le bouton d'annulation
// n'aurait été ajouté qu'à l'une des deux, et les libellés de statut auraient
// divergé au premier changement.

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-muted/20 text-muted',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmée',
  pending_payment: 'En attente de paiement',
  completed: 'Terminée',
  cancelled: 'Annulée',
  expired: 'Expirée',
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

/** `date` arrive déjà en heure mauricienne (`YYYY-MM-DD`) : on ne la reconvertit
 *  pas dans le fuseau du navigateur, on ne fait que l'habiller. */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function BookingCard({ booking }: { booking: Booking }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const cancel = useMutation(
    trpc.booking.cancel.mutationOptions({
      onSuccess: () => {
        // La liste ET le créneau côté catalogue ont changé : la place vient
        // d'être remise en vente.
        queryClient.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
      },
      onError: (err) => setError(err.message),
    }),
  )

  const handleCancel = () => {
    if (
      !confirm(
        `Annuler la réservation ${booking.bookingRef} ? Les places seront remises en vente.`,
      )
    ) {
      return
    }
    setError(null)
    cancel.mutate({ bookingId: booking.id })
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link
            href={`/activities/${booking.activitySlug}`}
            className="font-semibold text-ink hover:text-primary transition-colors"
          >
            {booking.activityTitle}
          </Link>
          <p className="text-sm text-muted">{booking.operatorName}</p>
          <p className="text-xs font-mono text-muted mt-1">
            {booking.bookingRef}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span>
            {formatDate(booking.date)} à {booking.time}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>{booking.participants} participant(s)</span>
        </div>
        {booking.contactPhone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-4 h-4" />
            <span>{booking.contactPhone}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-3 border-t border-surface">
        <div>
          <p className="text-xs text-muted">Acompte</p>
          <p className="text-accent font-semibold">
            &euro;{booking.depositDue.toFixed(0)}
          </p>
        </div>
        {booking.balanceDueOnSite > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted">Solde sur place</p>
            <p className="text-ink font-semibold">
              &euro;{booking.balanceDueOnSite.toFixed(0)}
            </p>
          </div>
        )}
      </div>

      {/* `cancellable` est dérivé côté serveur (server/mappers/booking.ts) :
          recombiner statut et date ici ferait apparaître un bouton que
          `booking.cancel` refuserait ensuite. */}
      {booking.cancellable && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancel.isPending}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-red-500 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {cancel.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Annuler la réservation
        </button>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  )
}

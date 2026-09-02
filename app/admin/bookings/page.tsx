'use client'

import { useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Mail, Phone, Search } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import type { AdminBookingRow } from '@/types/admin'
import type { BookingStatus } from '@/types/cart'

// Listing des réservations.
//
// Le back-office ne montrait qu'un COMPTEUR de réservations sur la vue
// d'ensemble. La mise en relation entre un touriste et son opérateur étant
// manuelle, l'admin devait ouvrir la base pour retrouver un numéro. Chaque
// ligne porte donc les deux contacts, cliquables.

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  expired: 'Expirée',
  completed: 'Terminée',
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-muted/20 text-muted',
  completed: 'bg-blue-100 text-blue-700',
}

const PERIODS = [
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passées' },
  { value: 'all', label: 'Toutes' },
] as const

const STATUSES = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'pending_payment', label: 'En attente' },
  { value: 'cancelled', label: 'Annulées' },
  { value: 'completed', label: 'Terminées' },
  { value: 'expired', label: 'Expirées' },
] as const

/** Contact cliquable. Un numéro qu'il faut recopier à la main ne sert à rien. */
function Contact({
  name,
  email,
  phone,
}: {
  name: string
  email: string
  phone?: string | null
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-ink truncate">{name}</p>
      <a
        href={`mailto:${email}`}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary truncate"
      >
        <Mail className="w-3 h-3 shrink-0" />
        {email}
      </a>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary"
        >
          <Phone className="w-3 h-3 shrink-0" />
          {phone}
        </a>
      )}
    </div>
  )
}

function BookingCard({ booking }: { booking: AdminBookingRow }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-semibold text-ink">
              {booking.bookingRef}
            </code>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[booking.status]}`}
            >
              {STATUS_LABEL[booking.status]}
            </span>
            {booking.departed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted">
                Départ passé
              </span>
            )}
          </div>
          <Link
            href={`/activities/${booking.activitySlug}`}
            className="text-sm text-muted hover:text-primary"
          >
            {booking.activityTitle}
          </Link>
          <p className="text-xs text-muted mt-0.5">
            {booking.date} à {booking.time} · {booking.participants} pers.
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-semibold text-ink">
            {formatEUR(booking.totalPrice)}
          </p>
          <p className="text-xs text-muted">
            acompte {formatEUR(booking.depositDue)}
          </p>
          <p className="text-xs text-muted">
            sur place {formatEUR(booking.balanceDueOnSite)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-muted/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Client
          </p>
          <Contact
            name={booking.touristName}
            email={booking.touristEmail}
            phone={booking.contactPhone}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Opérateur
          </p>
          <Contact name={booking.operatorName} email={booking.operatorEmail} />
        </div>
      </div>
    </div>
  )
}

export default function AdminBookingsPage() {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery(
    trpc.admin.bookings.queryOptions(
      {
        page,
        period,
        status: status as 'all',
        search: search.trim() || undefined,
      },
      {
        // Sans ça, changer de page ou de filtre vide la liste puis la repeint :
        // la hauteur saute et on perd sa place.
        placeholderData: keepPreviousData,
      },
    ),
  )

  const resetTo = (fn: () => void) => {
    fn()
    setPage(1)
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Réservations</h1>
        <p className="text-muted mt-1">
          Toutes les réservations de la plateforme, avec les coordonnées du
          client et de l&apos;opérateur — la mise en relation est manuelle.
        </p>
      </header>

      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => resetTo(() => setSearch(e.target.value))}
            placeholder="Référence MX-…, nom ou email du client"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => resetTo(() => setPeriod(p.value))}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                period === p.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted border-muted/20 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}

          <select
            value={status}
            onChange={(e) => resetTo(() => setStatus(e.target.value))}
            className="ml-auto px-3 py-1.5 rounded-xl text-sm border border-muted/20 bg-white focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl h-44 animate-pulse border border-muted/10"
            />
          ))}
        </div>
      ) : data.bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-10 text-center">
          <p className="text-muted">Aucune réservation ne correspond.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">
            {data.total} réservation{data.total > 1 ? 's' : ''}
          </p>

          <div className="space-y-4">
            {data.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-muted">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

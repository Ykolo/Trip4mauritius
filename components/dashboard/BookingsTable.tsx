'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, CreditCard } from 'lucide-react'
import type { OperatorBooking } from '@/lib/hooks/useCart'

interface BookingsTableProps {
  bookings: OperatorBooking[]
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  showPagination?: boolean
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function StatusBadge({ status }: { status: OperatorBooking['status'] }) {
  const styles = {
    confirmed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-500',
  }

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}

// Mobile card view
function BookingCard({ booking }: { booking: OperatorBooking }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-ink">{booking.touristName}</p>
          <p className="text-sm text-muted">{booking.activityTitle}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <Clock className="w-4 h-4" />
          <span>{booking.slot}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <Users className="w-4 h-4" />
          <span>{booking.participants} pax</span>
        </div>
        <div className="flex items-center gap-2 font-semibold text-ink">
          <CreditCard className="w-4 h-4" />
          <span>{formatCurrency(booking.amountHT)}</span>
        </div>
      </div>
    </div>
  )
}

export function BookingsTable({
  bookings,
  page = 1,
  totalPages = 1,
  onPageChange,
  showPagination = true,
}: BookingsTableProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div className="space-y-4">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted">Tourist</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted">Activity</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted">Slot</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted">Participants</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted">Amount HT</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-base transition-colors">
                <td className="px-4 py-3 text-sm text-ink whitespace-nowrap">
                  {formatDate(booking.date)}
                </td>
                <td className="px-4 py-3 text-sm text-ink">{booking.touristName}</td>
                <td className="px-4 py-3 text-sm text-ink max-w-[200px] truncate">
                  {booking.activityTitle}
                </td>
                <td className="px-4 py-3 text-sm text-ink">{booking.slot}</td>
                <td className="px-4 py-3 text-sm text-ink text-center">{booking.participants}</td>
                <td className="px-4 py-3 text-sm font-semibold text-ink text-right whitespace-nowrap">
                  {formatCurrency(booking.amountHT)}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={booking.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface">
          <button
            onClick={() => onPageChange?.(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-surface'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => onPageChange?.(page + 1)}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

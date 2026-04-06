'use client'

import Link from 'next/link'
import { Lock, Calendar, Users } from 'lucide-react'
import { useAuth, useMyBookings } from '@/lib/hooks/useCart'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import type { Booking } from '@/types/cart'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const styles = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  const labels = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    cancelled: 'Cancelled',
  }

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-ink">{booking.activityName}</h3>
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
            {formatDate(booking.date)} at {booking.time}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>{booking.participants} participant(s)</span>
        </div>
      </div>

      <div className="flex justify-between pt-3 border-t border-surface">
        <div>
          <p className="text-xs text-muted">Deposit paid</p>
          <p className="text-accent font-semibold">
            &euro;{booking.depositPaid}
          </p>
        </div>
        {booking.balanceDue > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted">Balance due</p>
            <p className="text-ink font-semibold">
              &euro;{booking.balanceDue}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const { data: user, isLoading: authLoading } = useAuth()
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings()

  // Loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-base py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="animate-pulse h-8 bg-surface rounded w-48 mb-6" />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-card p-8 text-center max-w-sm mx-4">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-muted" />
          </div>
          <h1 className="text-xl font-semibold text-ink mb-2">
            Sign in to view your bookings
          </h1>
          <p className="text-muted text-sm mb-6">
            Access your booking history and upcoming activities
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // Loading bookings
  if (bookingsLoading) {
    return (
      <div className="min-h-screen bg-base py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-2xl font-semibold text-ink mb-6">My Bookings</h1>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  // No bookings
  if (bookings.length === 0) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-xl font-semibold text-ink mb-2">
            No bookings yet
          </h1>
          <p className="text-muted mb-6">
            Start planning your Mauritius adventure
          </p>
          <Link
            href="/activities"
            className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform"
          >
            Browse Activities
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink mb-6">My Bookings</h1>
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      </div>
    </div>
  )
}

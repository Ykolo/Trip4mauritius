'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useMyBookings } from '@/lib/hooks/useBookings'
import { BookingCard } from '@/components/ui/BookingCard'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

export default function BookingsPage() {
  const { data: user, isLoading: authLoading } = useAuth()
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings(!!user)

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
          <h1 className="text-2xl font-semibold text-ink mb-6">
            Mes réservations
          </h1>
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
        <h1 className="text-2xl font-semibold text-ink mb-6">
          Mes réservations
        </h1>
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Calendar, Users, Loader2 } from 'lucide-react'
import {
  useAuth,
  useLogout,
  useUpdateProfile,
  useMyBookings,
  type User,
} from '@/lib/hooks/useCart'
import { AuthForm } from '@/components/forms/AuthForm'
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

function RoleBadge({ role }: { role: User['role'] }) {
  const styles = {
    tourist: 'bg-primary/10 text-primary',
    operator: 'bg-accent/10 text-accent',
    admin: 'bg-red-100 text-red-800',
  }

  const labels = {
    tourist: 'Tourist',
    operator: 'Operator',
    admin: 'Admin',
  }

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role]}`}
    >
      {labels[role]}
    </span>
  )
}

function ProfileHeader({ user }: { user: User }) {
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  return (
    <div className="rounded-2xl shadow-card bg-white p-6 flex gap-4">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`${user.firstName} ${user.lastName}`}
          className="w-16 h-16 rounded-full object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-xl">{initials}</span>
        </div>
      )}
      <div className="flex-1">
        <h2 className="font-semibold text-xl text-ink">
          {user.firstName} {user.lastName}
        </h2>
        <p className="text-muted text-sm">{user.email}</p>
        <div className="mt-2">
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>
  )
}

function PersonalInfoForm({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone)
  const [success, setSuccess] = useState(false)
  const updateProfile = useUpdateProfile()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSuccess(false)
      try {
        await updateProfile.mutateAsync({ firstName, lastName, email, phone })
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch {
        // Error handling
      }
    },
    [updateProfile, firstName, lastName, email, phone]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="profile-first-name"
            className="block text-sm font-medium text-ink mb-1.5"
          >
            First Name
          </label>
          <input
            id="profile-first-name"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="profile-last-name"
            className="block text-sm font-medium text-ink mb-1.5"
          >
            Last Name
          </label>
          <input
            id="profile-last-name"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="profile-email"
          className="block text-sm font-medium text-ink mb-1.5"
        >
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="profile-phone"
          className="block text-sm font-medium text-ink mb-1.5"
        >
          Phone
        </label>
        <input
          id="profile-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      {success && (
        <p className="text-green-600 text-sm">Profile updated successfully!</p>
      )}

      <button
        type="submit"
        disabled={updateProfile.isPending}
        className="w-full sm:w-auto bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {updateProfile.isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </form>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { data: user, isLoading: authLoading } = useAuth()
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings()
  const logout = useLogout()
  const [activeTab, setActiveTab] = useState<'bookings' | 'info'>('bookings')

  const handleLogout = useCallback(async () => {
    await logout.mutateAsync()
    router.push('/')
  }, [logout, router])

  // Loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-base py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="animate-pulse h-24 bg-surface rounded-2xl mb-6" />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  // Not logged in - show auth form
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8">
          <h1 className="font-display text-primary text-3xl">MauriExplore</h1>
        </Link>
        <AuthForm defaultTab="login" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Profile Header */}
        <ProfileHeader user={user} />

        {/* Tabs */}
        <div className="flex mt-6 bg-white rounded-xl p-1 shadow-card">
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'bookings'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            My Bookings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'info'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            Personal Info
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'bookings' && (
            <>
              {bookingsLoading ? (
                <div className="space-y-4">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : bookings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-card p-8 text-center">
                  <p className="text-muted mb-4">No bookings yet</p>
                  <Link
                    href="/activities"
                    className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform"
                  >
                    Browse Activities
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'info' && (
            <div className="bg-white rounded-2xl shadow-card p-6">
              <PersonalInfoForm user={user} />
            </div>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 text-red-500 border border-red-200 rounded-2xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {logout.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          Sign Out
        </button>
      </div>
    </div>
  )
}

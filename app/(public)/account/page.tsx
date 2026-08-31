'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Loader2 } from 'lucide-react'
import { useAuth, useLogout, type AuthUser } from '@/lib/hooks/useAuth'
import { useMyBookings } from '@/lib/hooks/useBookings'
import { authClient } from '@/lib/auth-client'
import { AuthForm } from '@/components/forms/AuthForm'
import { BookingCard } from '@/components/ui/BookingCard'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

function RoleBadge({ role }: { role: AuthUser['role'] }) {
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

/** Deux premières lettres des mots du nom — `name` est un champ libre, il peut
 *  ne contenir qu'un seul mot. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]
  return letters.toUpperCase()
}

function ProfileHeader({ user }: { user: AuthUser }) {
  return (
    <div className="rounded-2xl shadow-card bg-white p-6 flex gap-4">
      {user.image ? (
        <img
          src={user.image}
          alt={user.name}
          className="w-16 h-16 rounded-full object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-xl">
            {getInitials(user.name)}
          </span>
        </div>
      )}
      <div className="flex-1">
        <h2 className="font-semibold text-xl text-ink">{user.name}</h2>
        <p className="text-muted text-sm">{user.email}</p>
        <div className="mt-2">
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>
  )
}

function PersonalInfoForm({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSuccess(false)
      setError(null)
      setIsPending(true)

      const result = await authClient.updateUser({
        name: name.trim(),
        phone: phone.trim(),
      })

      setIsPending(false)

      if (result.error) {
        setError(result.error.message ?? 'Could not update your profile')
        return
      }

      // La session est mise en cache dans un cookie : sans rafraîchissement, le
      // nom affiché resterait l'ancien jusqu'à expiration du cache.
      router.refresh()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    },
    [name, phone, router]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="profile-name"
          className="block text-sm font-medium text-ink mb-1.5"
        >
          Full Name
        </label>
        <input
          id="profile-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="profile-email"
          className="block text-sm font-medium text-ink mb-1.5"
        >
          Email
        </label>
        {/* Lecture seule : changer d'adresse demande de vérifier la nouvelle,
            donc un envoi d'email — pas de fournisseur branché à ce stade.
            Un champ modifiable qui ne change rien serait pire que pas de champ. */}
        <input
          id="profile-email"
          type="email"
          value={user.email}
          readOnly
          disabled
          className="w-full px-4 py-3 rounded-2xl border border-surface bg-surface/50 text-muted cursor-not-allowed"
        />
      </div>

      <div>
        <label
          htmlFor="profile-phone"
          className="block text-sm font-medium text-ink mb-1.5"
        >
          Téléphone
        </label>
        {/* Valeur par défaut du checkout, rien de plus : le numéro qui engage
            une réservation est figé sur celle-ci au moment de la créer. Le
            modifier ici ne réécrit donc aucune réservation passée. */}
        <input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+230 5xxx xxxx"
          className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
        />
        <p className="text-xs text-muted mt-1.5">
          Pré-rempli lors de vos réservations, pour que l&apos;opérateur puisse
          vous joindre.
        </p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {success && (
        <p className="text-green-600 text-sm">Profile updated successfully!</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
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
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings(!!user)
  const logout = useLogout()
  const [activeTab, setActiveTab] = useState<'bookings' | 'info'>('bookings')

  const handleLogout = useCallback(async () => {
    await logout.mutateAsync()
    router.refresh()
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
          <h1 className="font-display text-primary text-3xl">Trip4mauritius</h1>
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

        {/* Accès aux espaces réservés.
            Sans ce raccourci, /admin et /operator ne sont atteignables qu'en
            tapant l'URL — les pages existent mais rien n'y mène. */}
        {(user.role === 'operator' || user.role === 'admin') && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/operator/dashboard"
              className="flex-1 min-w-[160px] text-center bg-white shadow-card rounded-2xl py-3 font-semibold text-ink hover:text-primary transition-colors"
            >
              Espace opérateur
            </Link>
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="flex-1 min-w-[160px] text-center bg-white shadow-card rounded-2xl py-3 font-semibold text-ink hover:text-primary transition-colors"
              >
                Administration
              </Link>
            )}
          </div>
        )}

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

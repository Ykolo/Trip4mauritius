'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Store, Ticket } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

// Vue d'ensemble — un état, pas une file d'attente.
//
// L'écran s'ouvrait sur « ce qui attend une décision » : activités à modérer,
// demandes opérateur. Ces deux notions ont disparu au lot 1, Trip4mauritius
// tenant son catalogue et créant ses opérateurs elle-même.
//
// Chaque tuile mène à l'onglet correspondant : un chiffre sur lequel on ne peut
// pas cliquer oblige à retrouver l'écran soi-même.

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  hint?: string
  icon: typeof Ticket
  href: string
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl p-6 shadow-card border border-muted/10 hover:border-primary/40 transition-colors block"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted text-sm font-semibold">{label}</span>
        <Icon className="w-5 h-5 text-muted" />
      </div>
      <span className="font-bold text-3xl text-ink">{value}</span>
      {hint && <p className="text-muted text-xs mt-1">{hint}</p>}
    </Link>
  )
}

export default function AdminOverviewPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.overview.queryOptions())

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">
          Vue d&apos;ensemble
        </h1>
        <p className="text-muted mt-1">L&apos;état de la plateforme.</p>
      </header>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile
            label="Activités en ligne"
            value={data.publishedActivities}
            icon={CheckCircle2}
            href="/admin/activities"
          />
          <Tile
            label="Réservations"
            value={data.pendingBookings + data.confirmedBookings}
            hint={`${data.pendingBookings} en attente · ${data.confirmedBookings} confirmée${data.confirmedBookings > 1 ? 's' : ''}`}
            icon={Ticket}
            href="/admin/bookings"
          />
          <Tile
            label="Opérateurs"
            value={data.totalOperators}
            icon={Store}
            href="/admin/operators"
          />
          <Tile
            label="Guides"
            value={data.publishedGuides}
            hint="articles en ligne"
            icon={BookOpen}
            href="/admin/guides"
          />
        </div>
      )}
    </div>
  )
}

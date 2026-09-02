'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Store, Ticket } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

function Tile({
  label,
  value,
  icon: Icon,
  href,
  urgent,
}: {
  label: string
  value: number
  icon: typeof Clock
  href?: string
  urgent?: boolean
}) {
  const content = (
    <div
      className={`bg-white rounded-2xl p-6 shadow-card border transition-colors ${
        urgent && value > 0
          ? 'border-primary/40 hover:border-primary'
          : 'border-muted/10'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted text-sm font-semibold">{label}</span>
        <Icon
          className={`w-5 h-5 ${urgent && value > 0 ? 'text-primary' : 'text-muted'}`}
        />
      </div>
      <span className="font-bold text-3xl text-ink">{value}</span>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
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
        <p className="text-muted mt-1">
          Ce qui attend une décision, et l&apos;état de la place de marché.
        </p>
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
        <>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-widest mb-3">
            En attente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Tile
              label="Activités à modérer"
              value={data.pendingActivities}
              icon={Clock}
              href="/admin/moderation"
              urgent
            />
            <Tile
              label="Demandes opérateur"
              value={data.pendingOperators}
              icon={Store}
              href="/admin/operators"
              urgent
            />
          </div>

          <h2 className="text-sm font-semibold text-muted uppercase tracking-widest mb-3">
            Place de marché
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tile
              label="Activités en ligne"
              value={data.publishedActivities}
              icon={CheckCircle2}
            />
            <Tile
              label="Opérateurs"
              value={data.totalOperators}
              icon={Store}
            />
            <Tile
              label="Réservations confirmées"
              value={data.totalBookings}
              icon={Ticket}
              href="/admin/bookings"
            />
          </div>
        </>
      )}
    </div>
  )
}

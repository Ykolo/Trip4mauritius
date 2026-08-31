'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Percent, Ticket, Users, Wallet } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'

// Les KPI de cette page étaient écrits en dur (« Ocean Adventures », « €1,240 »)
// et le graphique était un cadre en pointillés. Tout vient désormais de
// `operator.stats`, cloisonné par `ctx.operator.id`.

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string
  value: string
  icon: typeof Wallet
  hint: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border border-muted/10 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <span className="text-muted text-sm font-semibold">{title}</span>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div>
        <span className="font-body font-bold text-3xl text-ink">{value}</span>
        <p className="text-xs text-muted mt-1">{hint}</p>
      </div>
    </div>
  )
}

export default function OperatorDashboardPage() {
  const trpc = useTRPC()
  const { data: profile } = useQuery(trpc.operator.myProfile.queryOptions())
  const { data: stats, isLoading } = useQuery(trpc.operator.stats.queryOptions())
  const { data: departures } = useQuery(
    trpc.operator.upcomingDepartures.queryOptions(),
  )

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-primary md:hidden mb-1 flex items-center justify-between">
          Trip4mauritius
          <span className="text-ink font-body text-xs font-bold uppercase tracking-wider bg-white shadow-sm border border-muted/10 px-2 py-1 rounded-md">
            Pro
          </span>
        </h1>
        <h2 className="font-body font-bold text-2xl text-ink mt-6 md:mt-0">
          Bonjour, {profile?.displayName ?? '…'} 👋
        </h2>
        <p className="text-muted mt-1">
          Voici le résumé de votre activité sur l&apos;île Maurice.
        </p>
      </header>

      {isLoading || !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl h-36 shadow-card border border-muted/10 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            title="Chiffre d'affaires"
            value={formatEUR(stats.totalRevenue)}
            icon={Wallet}
            hint="Réservations confirmées"
          />
          <KpiCard
            title="Réservations"
            value={String(stats.totalBookings)}
            icon={Ticket}
            hint="Depuis le début"
          />
          <KpiCard
            title="Taux de remplissage"
            value={`${stats.occupancyRate} %`}
            icon={Percent}
            hint="Sur les départs à venir"
          />
          <KpiCard
            title="Départs à venir"
            value={String(stats.upcomingDepartures)}
            icon={CalendarClock}
            hint="Créneaux programmés"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-muted/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-body font-bold text-lg text-ink">
              Prochains départs
            </h3>
            <Link
              href="/operator/bookings"
              className="text-sm text-primary font-medium hover:underline"
            >
              Voir les réservations
            </Link>
          </div>

          {!departures ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-base rounded-xl animate-pulse" />
              ))}
            </div>
          ) : departures.length === 0 ? (
            <p className="text-muted text-sm py-8 text-center">
              Aucun départ réservé pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {departures.map((departure) => (
                <div
                  key={departure.slotId}
                  className="p-4 bg-base rounded-xl border border-muted/10 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-primary font-bold text-sm mb-0.5">
                      {departure.date} — {departure.time}
                    </p>
                    <p className="font-body font-semibold text-ink text-sm truncate">
                      {departure.activityTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted text-sm whitespace-nowrap">
                    <Users className="w-4 h-4" />
                    {departure.participants} / {departure.maxSpots}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6">
          <h3 className="font-body font-bold text-lg text-ink mb-4">
            Encaissements
          </h3>
          {stats && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted uppercase tracking-widest mb-1">
                  Acomptes perçus par la plateforme
                </p>
                <p className="font-bold text-2xl text-ink">
                  {formatEUR(stats.platformFee)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-widest mb-1">
                  Solde à encaisser sur place
                </p>
                <p className="font-bold text-2xl text-primary">
                  {formatEUR(stats.totalRevenue - stats.platformFee)}
                </p>
              </div>
              <Link
                href="/operator/wallet"
                className="block text-center text-sm text-primary font-medium hover:underline pt-2"
              >
                Voir le relevé
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

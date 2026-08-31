'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Send,
} from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import { ActivityForm } from '@/components/forms/ActivityForm'
import { SlotManager } from '@/components/dashboard/SlotManager'
import type { ActivityStatus } from '@/types/activity'
import type { OperatorActivitySummary } from '@/types/operator'

const STATUS_STYLES: Record<ActivityStatus, string> = {
  draft: 'bg-muted/20 text-muted',
  pending_moderation: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  archived: 'bg-muted/20 text-muted',
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: 'Brouillon',
  pending_moderation: 'En modération',
  published: 'En ligne',
  rejected: 'Refusée',
  archived: 'Archivée',
}

function ActivityRow({ activity }: { activity: OperatorActivitySummary }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: detail } = useQuery({
    ...trpc.operator.getActivity.queryOptions({ activityId: activity.id }),
    // Le détail complet n'est chargé qu'à l'ouverture : le tirer pour chaque
    // ligne rendrait la liste inutilement lourde.
    enabled: open || editing,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.operator.listActivities.queryKey(),
    })

  const submit = useMutation(
    trpc.operator.submitForModeration.mutationOptions({ onSuccess: invalidate }),
  )
  const archive = useMutation(
    trpc.operator.archiveActivity.mutationOptions({ onSuccess: invalidate }),
  )

  if (editing && detail) {
    return (
      <ActivityForm
        activity={detail}
        onSuccess={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 overflow-hidden">
      <div className="p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-ink">{activity.title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[activity.status]}`}
            >
              {STATUS_LABELS[activity.status]}
            </span>
          </div>
          <p className="text-sm text-muted">
            {activity.category} · {activity.region} ·{' '}
            {formatEUR(activity.priceHT)} / pers.
          </p>
          <p className="text-xs text-muted mt-1">
            {activity.slotCount} créneau(x) · {activity.bookingsCount}{' '}
            réservation(s)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activity.status === 'published' && (
            <Link
              href={`/activities/${activity.slug}`}
              className="px-3 py-2 text-sm text-primary hover:underline"
            >
              Voir la fiche
            </Link>
          )}

          <button
            onClick={() => setEditing(true)}
            className="p-2 text-muted hover:text-ink hover:bg-base rounded-lg"
            aria-label="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {(activity.status === 'draft' || activity.status === 'rejected') && (
            <button
              onClick={() => submit.mutate({ activityId: activity.id })}
              disabled={submit.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {submit.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Soumettre
            </button>
          )}

          <button
            onClick={() => {
              // Archiver, jamais supprimer : les réservations passées doivent
              // rester intactes.
              if (confirm(`Archiver « ${activity.title} » ? Elle disparaîtra du catalogue, les réservations passées sont conservées.`)) {
                archive.mutate({ activityId: activity.id })
              }
            }}
            disabled={archive.isPending}
            className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
            aria-label="Archiver"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            onClick={() => setOpen((o) => !o)}
            className="p-2 text-muted hover:text-ink hover:bg-base rounded-lg"
            aria-label={open ? 'Replier les créneaux' : 'Voir les créneaux'}
          >
            {open ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {(submit.error || archive.error) && (
        <p className="px-5 pb-4 text-sm text-red-500">
          {submit.error?.message ?? archive.error?.message}
        </p>
      )}

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-surface">
          <SlotManager
            activityId={activity.id}
            defaultCapacity={detail?.maxParticipants ?? 10}
          />
        </div>
      )}
    </div>
  )
}

export default function OperatorPlanningPage() {
  const trpc = useTRPC()
  const [creating, setCreating] = useState(false)
  const { data: activities, isLoading } = useQuery(
    trpc.operator.listActivities.queryOptions(),
  )

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-body font-bold text-3xl text-ink">
            Mes activités
          </h1>
          <p className="text-muted mt-1">
            Créez vos offres, programmez vos départs et suivez leur modération.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium"
          >
            <Plus className="w-5 h-5" />
            Nouvelle activité
          </button>
        )}
      </header>

      {creating && (
        <div className="mb-8">
          <ActivityForm
            onSuccess={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        !creating && (
          <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-12 text-center">
            <p className="text-ink font-bold mb-2">Aucune activité</p>
            <p className="text-muted text-sm mb-6">
              Créez votre première offre. Elle restera en brouillon jusqu&apos;à
              ce que vous la soumettiez à la modération.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium"
            >
              <Plus className="w-5 h-5" />
              Nouvelle activité
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  )
}

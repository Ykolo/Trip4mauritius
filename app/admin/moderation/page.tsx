'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, Loader2, X } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import type { ModerationActivity } from '@/types/admin'

type Queue = 'pending_moderation' | 'published' | 'rejected' | 'archived'

const QUEUES: { value: Queue; label: string }[] = [
  { value: 'pending_moderation', label: 'À modérer' },
  { value: 'published', label: 'En ligne' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'archived', label: 'Archivées' },
]

function ActivityCard({
  activity,
  queue,
}: {
  activity: ModerationActivity
  queue: Queue
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
    // Le catalogue public change aussi : une publication doit s'y voir.
    queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
  }

  const publish = useMutation(
    trpc.admin.publishActivity.mutationOptions({ onSuccess: invalidate }),
  )
  const reject = useMutation(
    trpc.admin.rejectActivity.mutationOptions({ onSuccess: invalidate }),
  )

  const error = publish.error ?? reject.error
  const pending = publish.isPending || reject.isPending

  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">{activity.title}</h3>
            <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
              {activity.operatorName}
              {activity.operatorVerified && (
                <BadgeCheck className="w-4 h-4 text-green-600" />
              )}
            </p>
            <p className="text-sm text-muted mt-1">
              {activity.category} · {activity.region} · {activity.duration} ·{' '}
              {formatEUR(activity.priceHT)} / pers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(queue === 'pending_moderation' || queue === 'published') && (
              <button
                onClick={() => reject.mutate({ activityId: activity.id })}
                disabled={pending}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                {queue === 'published' ? 'Dépublier' : 'Refuser'}
              </button>
            )}
            {queue === 'pending_moderation' && (
              <button
                onClick={() => publish.mutate({ activityId: activity.id })}
                disabled={pending}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {publish.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Publier
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted mb-3">
          <span
            className={
              activity.upcomingSlots === 0 ? 'text-red-600 font-medium' : ''
            }
          >
            {activity.upcomingSlots} créneau(x) à venir
          </span>
          <span>{activity.imageUrls.length} photo(s)</span>
          <span>{activity.languages.join(', ')}</span>
          <span>Max {activity.maxParticipants} pers.</span>
        </div>

        {/* Un modérateur doit LIRE le texte avant de décider : le replier par
            défaut garde la file lisible, mais il est là en un clic. */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-sm text-primary hover:underline"
        >
          {expanded ? 'Masquer le contenu' : 'Lire le contenu soumis'}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-surface space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                Description
              </p>
              <p className="text-sm text-ink whitespace-pre-line">
                {activity.description.fr}
              </p>
            </div>

            {activity.included.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                  Inclus
                </p>
                <p className="text-sm text-ink">
                  {activity.included.join(' · ')}
                </p>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              {activity.imageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-28 h-20 object-cover rounded-lg flex-shrink-0 bg-surface"
                />
              ))}
            </div>

            {activity.status === 'published' && (
              <Link
                href={`/activities/${activity.slug}`}
                className="text-sm text-primary hover:underline inline-block"
              >
                Voir la fiche publique
              </Link>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-3">{error.message}</p>}
      </div>
    </div>
  )
}

export default function AdminModerationPage() {
  const trpc = useTRPC()
  const [queue, setQueue] = useState<Queue>('pending_moderation')

  const { data, isLoading } = useQuery(
    trpc.admin.moderationQueue.queryOptions({ status: queue }),
  )

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Modération</h1>
        <p className="text-muted mt-1">
          Les soumissions les plus anciennes d&apos;abord.
        </p>
      </header>

      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-card overflow-x-auto">
        {QUEUES.map((q) => (
          <button
            key={q.value}
            onClick={() => setQueue(q.value)}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              queue === q.value
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-12 text-center">
          <p className="text-ink font-bold mb-1">Rien dans cette file</p>
          <p className="text-muted text-sm">
            {queue === 'pending_moderation'
              ? 'Aucune activité n’attend de décision.'
              : 'Aucune activité dans cet état.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} queue={queue} />
          ))}
        </div>
      )}
    </div>
  )
}

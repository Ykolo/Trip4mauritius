'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Loader2, Trash2 } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

// Gestion des créneaux d'une activité.
//
// Les horaires saisis ici sont en HEURE MAURICIENNE — c'est ce que l'opérateur
// lit sur son planning. La conversion en instant UTC est faite par le serveur
// (`fromMauritiusWallClock`) : envoyer un ISO fabriqué par le navigateur ferait
// entrer le fuseau du poste de l'opérateur dans la base, et un opérateur en
// déplacement décalerait ses propres départs.

interface DraftSlot {
  date: string
  time: string
  maxSpots: number
}

export function SlotManager({
  activityId,
  defaultCapacity,
}: {
  activityId: string
  defaultCapacity: number
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<DraftSlot[]>([])

  const { data: activity, isLoading } = useQuery(
    trpc.operator.getActivity.queryOptions({ activityId }),
  )

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.operator.getActivity.queryKey({ activityId }),
    })
    queryClient.invalidateQueries({
      queryKey: trpc.operator.listActivities.queryKey(),
    })
  }

  const createSlots = useMutation(
    trpc.operator.createSlots.mutationOptions({
      onSuccess: () => {
        setDrafts([])
        invalidate()
      },
    }),
  )

  const removeSlot = useMutation(
    trpc.operator.deleteSlot.mutationOptions({ onSuccess: invalidate }),
  )

  const today = new Date().toISOString().slice(0, 10)

  if (isLoading || !activity) {
    return <div className="h-24 bg-base rounded-xl animate-pulse" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-ink text-sm mb-3">
          Créneaux programmés ({activity.slots.length})
        </h4>

        {activity.slots.length === 0 ? (
          <p className="text-muted text-sm py-3">
            Aucun créneau. Une activité sans départ ne peut pas être soumise à la
            modération.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {activity.slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-base rounded-lg text-sm"
              >
                <span className="text-ink font-medium">
                  {slot.date} — {slot.time}
                </span>
                <span className="text-muted">
                  {slot.spotsTaken} / {slot.maxSpots} places
                </span>
                <button
                  onClick={() => removeSlot.mutate({ slotId: slot.id })}
                  // `slots → bookings` est en RESTRICT : le bouton est désactivé
                  // plutôt que de laisser l'opérateur buter sur une erreur de
                  // clé étrangère.
                  disabled={!slot.deletable || removeSlot.isPending}
                  title={
                    slot.deletable
                      ? 'Supprimer ce créneau'
                      : 'Ce créneau a des réservations'
                  }
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-surface">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-ink text-sm">Ajouter des départs</h4>
          <button
            onClick={() =>
              setDrafts((d) => [
                ...d,
                { date: '', time: '09:00', maxSpots: defaultCapacity },
              ])
            }
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <CalendarPlus className="w-4 h-4" />
            Nouveau créneau
          </button>
        </div>

        <div className="space-y-2">
          {drafts.map((draft, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={draft.date}
                min={today}
                onChange={(e) =>
                  setDrafts((d) =>
                    d.map((s, i) =>
                      i === index ? { ...s, date: e.target.value } : s,
                    ),
                  )
                }
                className="px-3 py-2 rounded-lg border border-surface bg-white text-sm"
              />
              <input
                type="time"
                value={draft.time}
                onChange={(e) =>
                  setDrafts((d) =>
                    d.map((s, i) =>
                      i === index ? { ...s, time: e.target.value } : s,
                    ),
                  )
                }
                className="px-3 py-2 rounded-lg border border-surface bg-white text-sm"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  value={draft.maxSpots}
                  onChange={(e) =>
                    setDrafts((d) =>
                      d.map((s, i) =>
                        i === index
                          ? { ...s, maxSpots: parseInt(e.target.value) || 1 }
                          : s,
                      ),
                    )
                  }
                  className="w-20 px-3 py-2 rounded-lg border border-surface bg-white text-sm"
                />
                <span className="text-xs text-muted">places</span>
              </div>
              <button
                onClick={() =>
                  setDrafts((d) => d.filter((_, i) => i !== index))
                }
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                aria-label="Retirer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {drafts.length > 0 && (
          <button
            onClick={() =>
              createSlots.mutate({
                activityId,
                slots: drafts.filter((d) => d.date && d.time),
              })
            }
            disabled={
              createSlots.isPending || !drafts.some((d) => d.date && d.time)
            }
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {createSlots.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Enregistrer {drafts.filter((d) => d.date).length} créneau(x)
          </button>
        )}

        {createSlots.error && (
          <p className="text-red-500 text-sm mt-2">
            {createSlots.error.message}
          </p>
        )}
        {removeSlot.error && (
          <p className="text-red-500 text-sm mt-2">{removeSlot.error.message}</p>
        )}
      </div>
    </div>
  )
}

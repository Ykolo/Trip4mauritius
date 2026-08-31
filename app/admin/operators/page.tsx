'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, Clock, Loader2, ShieldOff } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { OperatorRequest } from '@/types/admin'

function OperatorRow({ operator }: { operator: OperatorRequest }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
    queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
  }

  const approve = useMutation(
    trpc.admin.approveOperator.mutationOptions({ onSuccess: invalidate }),
  )
  const revoke = useMutation(
    trpc.admin.revokeOperator.mutationOptions({ onSuccess: invalidate }),
  )

  const pending = approve.isPending || revoke.isPending
  const error = approve.error ?? revoke.error
  const isActive = operator.role === 'operator' || operator.role === 'admin'

  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-ink">{operator.displayName}</h3>
            {operator.verified ? (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <BadgeCheck className="w-3.5 h-3.5" />
                Vérifié
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                En attente
              </span>
            )}
            {operator.role === 'admin' && (
              <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </div>

          {/* L'identité réelle derrière le nom commercial : c'est sur elle que
              porte la décision de validation, pas sur l'enseigne. */}
          <p className="text-sm text-muted mt-1">
            {operator.userName} — {operator.userEmail}
          </p>
          <p className="text-xs text-muted mt-1">
            {operator.activityCount} activité(s) · demande du{' '}
            {new Date(operator.requestedAt).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isActive && (
            <button
              onClick={() =>
                approve.mutate({ operatorId: operator.operatorId })
              }
              disabled={pending}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {approve.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Valider
            </button>
          )}

          {isActive && operator.role !== 'admin' && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Révoquer « ${operator.displayName} » ? Ses activités en ligne seront archivées et son compte repassera touriste. Les réservations déjà prises restent honorées.`,
                  )
                ) {
                  revoke.mutate({ operatorId: operator.operatorId })
                }
              }}
              disabled={pending}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              <ShieldOff className="w-4 h-4" />
              Révoquer
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-3">{error.message}</p>}
    </div>
  )
}

export default function AdminOperatorsPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.admin.operatorRequests.queryOptions(),
  )

  const waiting = data?.filter((o) => o.role === 'tourist') ?? []
  const active = data?.filter((o) => o.role !== 'tourist') ?? []

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">Opérateurs</h1>
        <p className="text-muted mt-1">
          Valider une demande est le seul moyen d&apos;accorder le rôle
          opérateur.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-28 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-widest mb-3">
            Demandes en attente ({waiting.length})
          </h2>
          {waiting.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-8 text-center mb-8">
              <p className="text-muted text-sm">Aucune demande en attente.</p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {waiting.map((operator) => (
                <OperatorRow key={operator.operatorId} operator={operator} />
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-muted uppercase tracking-widest mb-3">
            Opérateurs actifs ({active.length})
          </h2>
          <div className="space-y-4">
            {active.map((operator) => (
              <OperatorRow key={operator.operatorId} operator={operator} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

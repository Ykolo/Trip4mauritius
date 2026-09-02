'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { FeatureFlagRow } from '@/types/admin'

// Écran de bascule des fonctionnalités.
//
// Il n'invente aucun flag : la liste vient du registre `lib/features.ts`. Une
// clé qui y disparaît disparaît d'ici, même si sa ligne traîne encore en base.

const SOURCE_LABEL: Record<FeatureFlagRow['source'], string> = {
  default: 'valeur par défaut du code',
  env: "variable d'environnement",
  database: 'basculé depuis cet écran',
}

function Toggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 shrink-0 ${
        enabled ? 'bg-primary' : 'bg-muted/30'
      }`}
    >
      <span
        className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function FlagCard({ flag }: { flag: FeatureFlagRow }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Deux rafraîchissements, et les deux comptent : `invalidateQueries` remet à
  // jour cet écran, `router.refresh()` refait le rendu SERVEUR du layout racine
  // — c'est lui qui porte les flags jusqu'aux composants clients. Sans le
  // second, l'interrupteur bascule ici mais le pied de page ne bouge pas.
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
    router.refresh()
  }

  const set = useMutation(trpc.admin.setFeature.mutationOptions({ onSuccess }))
  const reset = useMutation(
    trpc.admin.resetFeature.mutationOptions({ onSuccess }),
  )

  const pending = set.isPending || reset.isPending
  const error = set.error ?? reset.error

  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-ink">{flag.label}</h3>
            <code className="text-xs text-muted bg-base px-1.5 py-0.5 rounded">
              {flag.key}
            </code>
            {flag.expired && (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" />
                À retirer
              </span>
            )}
          </div>

          <p className="text-sm text-muted mt-1.5">{flag.description}</p>

          <p className="text-xs text-muted mt-2">
            Actuellement : <strong>{SOURCE_LABEL[flag.source]}</strong> · défaut{' '}
            {flag.defaultValue ? 'activé' : 'désactivé'} ·{' '}
            <code>{flag.envVar}</code>
          </p>

          {flag.updatedBy && flag.updatedAt && (
            <p className="text-xs text-muted mt-1">
              Dernière bascule par {flag.updatedBy} le{' '}
              {new Date(flag.updatedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </div>

        <Toggle
          enabled={flag.enabled}
          disabled={pending}
          onChange={(next) => set.mutate({ key: flag.key, enabled: next })}
        />
      </div>

      {flag.source === 'database' && (
        <button
          onClick={() => reset.mutate({ key: flag.key })}
          disabled={pending}
          className="flex items-center gap-1.5 mt-4 text-xs text-muted hover:text-ink disabled:opacity-50"
        >
          {reset.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          Rendre la main à l&apos;environnement / au défaut du code
        </button>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error.message}</p>}
    </div>
  )
}

export default function AdminFeaturesPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.features.queryOptions())

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">
          Fonctionnalités
        </h1>
        <p className="text-muted mt-1">
          Activer ou désactiver une fonctionnalité sans redéployer. La bascule
          met jusqu&apos;à une minute à se propager à toutes les instances du
          site.
        </p>
      </header>

      {isLoading || !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl h-32 animate-pulse border border-muted/10"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((flag) => (
            <FlagCard key={flag.key} flag={flag} />
          ))}
        </div>
      )}
    </div>
  )
}

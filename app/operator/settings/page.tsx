'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Clock, Loader2 } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

export default function OperatorSettingsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: profile } = useQuery(trpc.operator.myProfile.queryOptions())

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saved, setSaved] = useState(false)

  // Le formulaire est initialisé depuis le serveur plutôt que rendu vide :
  // afficher des champs vierges laisserait croire que le profil est incomplet.
  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName)
    setAvatarUrl(profile.avatarUrl ?? '')
  }, [profile])

  const update = useMutation(
    trpc.operator.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.operator.myProfile.queryKey(),
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    }),
  )

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="font-body font-bold text-3xl text-ink">
          Profil opérateur
        </h1>
        <p className="text-muted mt-1">
          Ces informations apparaissent sur toutes vos fiches d&apos;activité.
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-6 border-b border-surface">
          {profile?.verified ? (
            <>
              <BadgeCheck className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-ink">Opérateur vérifié</p>
                <p className="text-sm text-muted">
                  Le badge de confiance est affiché sur vos fiches.
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-6 h-6 text-amber-600" />
              <div>
                <p className="font-semibold text-ink">Vérification en attente</p>
                <p className="text-sm text-muted">
                  Un administrateur doit valider votre profil.
                </p>
              </div>
            </>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate({
              displayName: displayName.trim(),
              avatarUrl: avatarUrl.trim(),
            })
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Nom commercial
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="avatarUrl"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Logo (URL)
            </label>
            <input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
            />
            <p className="text-xs text-muted mt-1.5">
              L&apos;envoi de fichiers arrivera avec le stockage d&apos;images.
            </p>
          </div>

          {update.error && (
            <p className="text-red-500 text-sm">{update.error.message}</p>
          )}
          {saved && (
            <p className="text-green-600 text-sm">Profil enregistré.</p>
          )}

          <button
            type="submit"
            disabled={update.isPending}
            className="bg-primary text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-2"
          >
            {update.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  )
}

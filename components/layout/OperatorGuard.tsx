'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Loader2, Lock, Store } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

// Cloisonnement RÉEL de /operator/*.
//
// `proxy.ts` ne vérifie que la présence d'un cookie de session : un touriste
// connecté atteignait donc les pages opérateur. Il ne peut pas faire mieux — le
// rôle vient du cache de session (5 min) et s'y fier produirait de fausses
// redirections à l'expiration.
//
// Le vrai contrôle est ici et, surtout, dans `operatorProcedure` : cet écran ne
// décide de rien, il interroge le serveur et rend ce que le serveur répond. Un
// client qui mentirait sur son rôle verrait un menu, pas une donnée.

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-card p-8 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  )
}

function RequestAccessForm() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')

  const request = useMutation(
    trpc.operator.requestAccess.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.operator.myProfile.queryKey(),
        }),
    }),
  )

  return (
    <>
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Store className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-xl font-semibold text-ink mb-2">
        Devenir opérateur
      </h1>
      <p className="text-muted text-sm mb-6">
        Publiez vos activités sur Trip4mauritius. Un administrateur validera
        votre demande avant la mise en ligne.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          request.mutate({ displayName: displayName.trim() })
        }}
        className="space-y-4 text-left"
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
            placeholder="Blue Safari Mauritius"
            className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
          />
          <p className="text-xs text-muted mt-1.5">
            C&apos;est le nom que verront les touristes sur vos fiches.
          </p>
        </div>

        {request.error && (
          <p className="text-red-500 text-sm">{request.error.message}</p>
        )}

        <button
          type="submit"
          disabled={request.isPending}
          className="w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {request.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          Envoyer ma demande
        </button>
      </form>
    </>
  )
}

export function OperatorGuard({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC()
  const { data: profile, isLoading, error } = useQuery(
    trpc.operator.myProfile.queryOptions(),
  )

  if (isLoading) {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      </Centered>
    )
  }

  // `myProfile` est une procédure protégée : sans session, elle répond
  // UNAUTHORIZED. Le proxy aurait normalement déjà redirigé — ce cas ne se
  // produit que si le cookie expire pendant la navigation.
  if (error) {
    return (
      <Centered>
        <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-muted" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          Session expirée
        </h1>
        <Link
          href="/login?redirect=/operator/dashboard"
          className="inline-block w-full bg-primary text-white font-semibold py-3 rounded-2xl mt-4"
        >
          Se reconnecter
        </Link>
      </Centered>
    )
  }

  if (!profile) {
    return (
      <Centered>
        <RequestAccessForm />
      </Centered>
    )
  }

  // Profil créé mais rôle pas encore basculé : la demande attend un admin.
  // La promotion ne prend effet qu'au rafraîchissement du cache de session,
  // d'où la mention explicite — sans elle, l'opérateur validé croirait que
  // rien n'a bougé.
  if (profile.role !== 'operator' && profile.role !== 'admin') {
    return (
      <Centered>
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          Demande en cours d&apos;examen
        </h1>
        <p className="text-muted text-sm mb-2">
          Votre demande pour <strong>{profile.displayName}</strong> a bien été
          enregistrée. Un administrateur doit la valider.
        </p>
        <p className="text-muted text-xs">
          Une fois validée, reconnectez-vous pour que votre nouveau rôle prenne
          effet.
        </p>
        <Link
          href="/account"
          className="inline-block w-full bg-surface text-ink font-semibold py-3 rounded-2xl mt-6"
        >
          Retour à mon compte
        </Link>
      </Centered>
    )
  }

  return <>{children}</>
}

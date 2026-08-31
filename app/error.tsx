'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RefreshCw, TriangleAlert } from 'lucide-react'

// Frontière d'erreur des routes.
//
// Obligatoirement un composant client : React lui passe `reset`, qui retente le
// rendu du segment fautif sans recharger toute la page.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // En production, `error.message` est volontairement masqué par Next : seul
    // `digest` remonte au client. C'est ce qui rend cette trace utile — elle
    // relie l'écran vu par l'utilisateur à l'erreur réelle dans les logs.
    console.error('Erreur de rendu:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="inline-block mb-10">
          <span className="font-display text-primary text-3xl">
            Trip4mauritius
          </span>
        </Link>

        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <TriangleAlert className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="font-body font-bold text-2xl text-ink mb-3">
          Quelque chose s&apos;est mal passé
        </h1>
        <p className="text-muted mb-8">
          L&apos;incident vient de chez nous, pas de vous. Réessayer suffit le
          plus souvent.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-transform"
          >
            <RefreshCw className="w-5 h-5" />
            Réessayer
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white shadow-card text-ink font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-transform"
          >
            <Home className="w-5 h-5" />
            Accueil
          </Link>
        </div>

        {/* Le digest est la SEULE chose qui permette de retrouver l'incident
            dans les logs. Sans lui, un signalement se réduit à « ça a planté ». */}
        {error.digest && (
          <p className="mt-8 text-xs text-muted">
            Référence de l&apos;incident :{' '}
            <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  )
}

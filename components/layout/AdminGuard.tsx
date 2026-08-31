'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

// Comme `OperatorGuard`, cet écran ne décide de rien : il appelle
// `admin.overview`, qui est une `adminProcedure`. Si le serveur répond, c'est
// que le compte est administrateur ; s'il refuse, on affiche le refus. Le
// contrôle réel est côté serveur — celui-ci n'évite qu'un écran vide.

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC()
  const { isLoading, error } = useQuery(trpc.admin.overview.queryOptions())

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-ink mb-2">Accès refusé</h1>
          <p className="text-muted text-sm mb-6">
            Cet espace est réservé aux administrateurs.
          </p>
          <Link
            href="/"
            className="inline-block w-full bg-primary text-white font-semibold py-3 rounded-2xl"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

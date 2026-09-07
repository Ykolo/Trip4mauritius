'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
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

  // Plus d'auto-inscription depuis le lot 1 : seul un administrateur
  // Trip4mauritius crée un opérateur, depuis /admin/operators. On l'annonce au
  // lieu d'afficher un formulaire dont l'envoi n'aboutirait nulle part.
  if (!profile) {
    return (
      <Centered>
        <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-muted" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          Espace réservé aux opérateurs partenaires
        </h1>
        <p className="text-muted text-sm mb-6">
          Les comptes opérateur sont ouverts par notre équipe. Contactez-nous
          pour référencer vos activités sur Trip4mauritius.
        </p>
        <Link
          href="/account"
          className="inline-block w-full bg-surface text-ink font-semibold py-3 rounded-2xl"
        >
          Retour à mon compte
        </Link>
      </Centered>
    )
  }

  // Un profil existe mais le rôle n'a pas suivi : anomalie, pas une file
  // d'attente. `createOperator` écrit les deux dans la même transaction, donc
  // ce cas ne devrait plus se produire — il reste affiché pour ne pas laisser
  // un écran blanc si une donnée ancienne traîne.
  if (profile.role !== 'operator' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    return (
      <Centered>
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          Compte incomplet
        </h1>
        <p className="text-muted text-sm mb-2">
          Le profil <strong>{profile.displayName}</strong> existe mais votre
          compte n&apos;a pas le rôle opérateur. Signalez-le à l&apos;équipe
          Trip4mauritius.
        </p>
        <p className="text-muted text-xs">
          Si le rôle vient d&apos;être posé, reconnectez-vous pour qu&apos;il
          prenne effet.
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

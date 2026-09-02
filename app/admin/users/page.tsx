'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BadgeCheck, Mail, Search } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { AdminUserRow } from '@/types/admin'

// Listing des comptes, en LECTURE seule.
//
// Aucune action de promotion ici, et ce n'est pas un manque : `approveOperator`
// (écran Opérateurs) reste le seul chemin vers le rôle opérateur, et rien dans
// le projet ne sait fabriquer un admin — le premier vient du seed. Un écran de
// « gestion des utilisateurs » capable de changer un rôle serait une porte
// permanente vers l'auto-promotion.

const ROLES = [
  { value: 'all', label: 'Tous' },
  { value: 'tourist', label: 'Touristes' },
  { value: 'operator', label: 'Opérateurs' },
  { value: 'admin', label: 'Admins' },
] as const

const ROLE_STYLE: Record<string, string> = {
  tourist: 'bg-muted/15 text-muted',
  operator: 'bg-primary/10 text-primary',
  admin: 'bg-red-100 text-red-700',
}

function UserRow({ user }: { user: AdminUserRow }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-ink truncate">{user.name}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${ROLE_STYLE[user.role] ?? ROLE_STYLE.tourist}`}
          >
            {user.role}
          </span>
          {user.operatorName && (
            <span className="flex items-center gap-1 text-xs text-muted">
              {user.operatorVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
              )}
              {user.operatorName}
            </span>
          )}
        </div>
        <a
          href={`mailto:${user.email}`}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary truncate"
        >
          <Mail className="w-3 h-3 shrink-0" />
          {user.email}
        </a>
      </div>

      <div className="text-right text-xs text-muted shrink-0">
        <p>
          {user.bookingsCount} réservation{user.bookingsCount > 1 ? 's' : ''}
        </p>
        <p>inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}</p>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const [role, setRole] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery(
    trpc.admin.users.queryOptions(
      { page, role: role as 'all', search: search.trim() || undefined },
      { placeholderData: keepPreviousData },
    ),
  )

  const resetTo = (fn: () => void) => {
    fn()
    setPage(1)
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Comptes</h1>
        <p className="text-muted mt-1">
          Qui s&apos;est inscrit, avec quel rôle. Les rôles se changent depuis
          l&apos;écran <strong>Opérateurs</strong>, pas ici.
        </p>
      </header>

      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => resetTo(() => setSearch(e.target.value))}
            placeholder="Nom ou email"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => resetTo(() => setRole(r.value))}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                role === r.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted border-muted/20 hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl h-20 animate-pulse border border-muted/10"
            />
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-10 text-center">
          <p className="text-muted">Aucun compte ne correspond.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">
            {data.total} compte{data.total > 1 ? 's' : ''}
          </p>

          <div className="space-y-3">
            {data.users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-muted">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

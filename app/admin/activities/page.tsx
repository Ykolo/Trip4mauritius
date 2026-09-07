'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import { ActivityForm } from '@/components/forms/ActivityForm'
import { SlotManager } from '@/components/dashboard/SlotManager'
import type { ActivityStatus } from '@/types/activity'
import type { AdminActivityRow } from '@/types/admin'

// Gestion du catalogue par l'admin.
//
// Distinct de `/admin/moderation`, et pas par commodité : la modération traite
// ce que les opérateurs SOUMETTENT (file d'attente, on accepte ou on refuse).
// Cet écran-ci sert à SAISIR et corriger le catalogue — c'est ce dont la
// plateforme a besoin au lancement, quand aucun opérateur n'est encore
// autonome et que le client remplit lui-même ses séjours.

const STATUS_STYLES: Record<ActivityStatus, string> = {
  draft: 'bg-muted/20 text-muted',
  pending_moderation: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  archived: 'bg-muted/20 text-muted',
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: 'Brouillon',
  pending_moderation: 'En modération',
  published: 'En ligne',
  rejected: 'Refusée',
  archived: 'Archivée',
}

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'published', label: 'En ligne' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'pending_moderation', label: 'En modération' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'archived', label: 'Archivées' },
] as const

type StatusFilter = (typeof FILTERS)[number]['value']

function ActivityRow({ activity }: { activity: AdminActivityRow }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: detail } = useQuery({
    ...trpc.admin.activity.queryOptions({ activityId: activity.id }),
    // Le détail n'est tiré qu'à l'ouverture : vingt lignes feraient sinon vingt
    // requêtes pour afficher une liste.
    enabled: open || editing,
  })

  // La ligne ET le détail : après une mise en ligne, le panneau déplié porte
  // encore l'ancien statut si on ne l'invalide pas.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.activities.queryKey() })
    queryClient.invalidateQueries({
      queryKey: trpc.admin.activity.queryKey({ activityId: activity.id }),
    })
  }

  const setStatus = useMutation(
    trpc.admin.setActivityStatus.mutationOptions({ onSuccess: invalidate }),
  )

  if (editing) {
    // Le formulaire a besoin de la fiche complète — description, inclus,
    // photos — que la ligne ne porte pas. Sans cet état d'attente, un clic sur
    // « Modifier » ne produit rien de visible tant que la requête n'a pas
    // répondu, et l'admin clique une seconde fois.
    if (!detail) {
      return (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-8 flex items-center justify-center gap-2 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement de la fiche…
        </div>
      )
    }

    return (
      <ActivityForm
        scope="admin"
        activity={detail}
        onSuccess={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const published = activity.status === 'published'
  // La garde vit aussi côté serveur ; ici elle évite d'offrir un bouton dont on
  // sait déjà qu'il répondra par une erreur.
  const publishable = activity.upcomingSlots > 0

  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 overflow-hidden">
      <div className="p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-ink">{activity.title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[activity.status]}`}
            >
              {STATUS_LABELS[activity.status]}
            </span>
          </div>
          <p className="text-sm text-muted">
            {activity.operatorName} · {activity.category} · {activity.region} ·{' '}
            {formatEUR(activity.priceHT)} / pers.
          </p>
          <p className="text-xs text-muted mt-1">
            {activity.upcomingSlots} départ(s) à venir · {activity.slotCount}{' '}
            créneau(x) · {activity.bookingsCount} réservation(s) · modifiée le{' '}
            {new Date(activity.updatedAt).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {published && (
            <Link
              href={`/activities/${activity.slug}`}
              className="px-3 py-2 text-sm text-primary hover:underline"
            >
              Voir la fiche
            </Link>
          )}

          <button
            onClick={() => setEditing(true)}
            className="p-2 text-muted hover:text-ink hover:bg-base rounded-lg"
            aria-label="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              setStatus.mutate({
                activityId: activity.id,
                // Dépublier renvoie en brouillon, pas en « refusée » : refuser
                // est un verdict de modération adressé à un opérateur, retirer
                // du catalogue est un geste d'édition.
                status: published ? 'draft' : 'published',
              })
            }
            disabled={
              setStatus.isPending ||
              activity.status === 'archived' ||
              (!published && !publishable)
            }
            title={
              !published && !publishable
                ? 'Aucun départ à venir : ajoutez un créneau avant de mettre en ligne.'
                : published
                  ? 'Retirer du catalogue'
                  : 'Mettre en ligne'
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-surface text-ink hover:bg-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {setStatus.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : published ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {published ? 'Retirer' : 'Mettre en ligne'}
          </button>

          <button
            onClick={() => {
              // Archiver, jamais supprimer : `slots → bookings` est en RESTRICT
              // et les réservations passées doivent rester lisibles.
              if (
                confirm(
                  `Archiver « ${activity.title} » ? Elle sort du catalogue ; les réservations passées sont conservées.`,
                )
              ) {
                setStatus.mutate({
                  activityId: activity.id,
                  status: 'archived',
                })
              }
            }}
            disabled={setStatus.isPending || activity.status === 'archived'}
            className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
            aria-label="Archiver"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            onClick={() => setOpen((o) => !o)}
            className="p-2 text-muted hover:text-ink hover:bg-base rounded-lg"
            aria-label={open ? 'Replier les créneaux' : 'Voir les créneaux'}
          >
            {open ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {setStatus.error && (
        <p className="px-5 pb-4 text-sm text-red-500">
          {setStatus.error.message}
        </p>
      )}

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-surface">
          <SlotManager
            scope="admin"
            activityId={activity.id}
            defaultCapacity={detail?.maxParticipants ?? 10}
          />
        </div>
      )}
    </div>
  )
}

export default function AdminCatalogPage() {
  const trpc = useTRPC()
  const [creating, setCreating] = useState(false)
  // Deux opérateurs distincts, et deux états : celui POUR QUI on crée une
  // fiche, et celui DONT on regarde le catalogue. Les confondre publierait chez
  // le prestataire qu'on était simplement en train de consulter.
  const [createFor, setCreateFor] = useState('')
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(
    trpc.admin.activities.queryOptions({
      page,
      status,
      search: search.trim() || undefined,
      operatorId: owner || undefined,
    }),
  )

  const { data: operators = [] } = useQuery(
    trpc.admin.operatorOptions.queryOptions(),
  )

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-body font-bold text-3xl text-ink">Catalogue</h1>
          <p className="text-muted mt-1">
            Saisissez et corrigez les séjours de la plateforme, quel qu&apos;en
            soit l&apos;opérateur.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium"
          >
            <Plus className="w-5 h-5" />
            Nouvelle activité
          </button>
        )}
      </header>

      {creating && (
        <div className="mb-8 space-y-4">
          <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-5">
            <label className="block text-sm font-medium text-ink mb-2">
              Opérateur *
            </label>
            <select
              value={createFor}
              onChange={(e) => setCreateFor(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Choisir…</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.displayName}
                  {operator.verified ? '' : ' (non vérifié)'} —{' '}
                  {operator.activityCount} activité(s)
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-2">
              Une activité appartient toujours à un opérateur : c&apos;est lui
              qui verra ses départs et ses passagers.
            </p>
          </div>

          <ActivityForm
            scope="admin"
            operatorId={createFor || undefined}
            onSuccess={() => {
              setCreating(false)
              setCreateFor('')
            }}
            onCancel={() => {
              setCreating(false)
              setCreateFor('')
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Titre, slug ou opérateur…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {/* La recherche ne trouve un opérateur que par le nom qu'on tape
            correctement. Ce sélecteur donne la liste exacte — c'est lui qu'on
            utilise pour reprendre le catalogue d'un prestataire fiche à
            fiche. */}
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value)
            setPage(1)
          }}
          aria-label="Filtrer par opérateur"
          className="px-3 py-2.5 rounded-xl border border-surface bg-white text-sm max-w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tous les opérateurs</option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.displayName}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setStatus(filter.value)
                setPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                status === filter.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-muted border border-surface hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.activities.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-12 text-center">
          <p className="text-ink font-bold mb-2">Aucune activité</p>
          <p className="text-muted text-sm">
            {search || owner || status !== 'all'
              ? 'Aucun résultat pour ce filtre.'
              : 'Créez la première fiche du catalogue.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data.activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl border border-surface bg-white text-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-muted">
                Page {page} / {data.pages} — {data.total} activité(s)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="px-4 py-2 rounded-xl border border-surface bg-white text-sm disabled:opacity-40"
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

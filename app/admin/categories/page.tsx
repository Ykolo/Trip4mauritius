'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { CategoryAdmin } from '@/types/category'

// Gestion du catalogue de catégories.
//
// Avant cet écran, `Activity.category` était un texte libre et la liste des
// choix vivait en dur dans trois composants qui ne disaient pas la même chose.

/** Champs communs à la création et à l'édition. */
function CategoryFields({
  label,
  emoji,
  imageUrl,
  onChange,
}: {
  label: string
  emoji: string
  imageUrl: string
  onChange: (field: 'label' | 'emoji' | 'imageUrl', value: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-3">
      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Libellé
        </label>
        <input
          value={label}
          onChange={(e) => onChange('label', e.target.value)}
          required
          minLength={2}
          maxLength={40}
          placeholder="Sports nautiques"
          className="w-full px-3 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Emoji
        </label>
        <input
          value={emoji}
          onChange={(e) => onChange('emoji', e.target.value)}
          maxLength={8}
          placeholder="🤿"
          className="w-full px-3 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-muted mb-1">
          Image (URL)
        </label>
        <input
          value={imageUrl}
          onChange={(e) => onChange('imageUrl', e.target.value)}
          maxLength={500}
          placeholder="/images/regions/north.jpg"
          className="w-full px-3 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted mt-1">
          Illustration des vignettes de l&apos;accueil. Vide, un visuel par
          défaut est utilisé.
        </p>
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  isFirst,
  isLast,
}: {
  category: CategoryAdmin
  isFirst: boolean
  isLast: boolean
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    label: category.label,
    emoji: category.emoji ?? '',
    imageUrl: category.imageUrl ?? '',
  })

  // `router.refresh()` en plus de l'invalidation : les catégories alimentent le
  // catalogue rendu côté serveur, pas seulement cet écran.
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
    queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
    router.refresh()
    setEditing(false)
  }

  const update = useMutation(
    trpc.admin.updateCategory.mutationOptions({ onSuccess }),
  )
  const setActive = useMutation(
    trpc.admin.setCategoryActive.mutationOptions({ onSuccess }),
  )
  const move = useMutation(
    trpc.admin.moveCategory.mutationOptions({ onSuccess }),
  )

  const pending = update.isPending || setActive.isPending || move.isPending
  const error = update.error ?? setActive.error ?? move.error

  return (
    <div
      className={`bg-white rounded-2xl shadow-card border p-4 ${
        category.active ? 'border-muted/10' : 'border-dashed border-muted/40'
      }`}
    >
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate({
              categoryId: category.id,
              label: draft.label.trim(),
              emoji: draft.emoji.trim() || undefined,
              imageUrl: draft.imageUrl.trim() || undefined,
            })
          }}
          className="space-y-3"
        >
          <CategoryFields
            {...draft}
            onChange={(field, value) =>
              setDraft((prev) => ({ ...prev, [field]: value }))
            }
          />
          <p className="text-xs text-muted">
            L&apos;adresse <code>{category.slug}</code> ne change pas : elle vit
            dans les liens déjà partagés.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-2 border border-muted/20 text-muted rounded-xl text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {category.emoji && <span className="text-lg">{category.emoji}</span>}
              <h3 className="font-semibold text-ink">{category.label}</h3>
              <code className="text-xs text-muted bg-base px-1.5 py-0.5 rounded">
                {category.slug}
              </code>
              {!category.active && (
                <span className="text-xs text-muted bg-muted/10 px-2 py-0.5 rounded-full">
                  Masquée
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1">
              {category.activityCount} activité(s)
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => move.mutate({ categoryId: category.id, direction: 'up' })}
              disabled={pending || isFirst}
              title="Monter"
              className="p-2 text-muted hover:text-ink disabled:opacity-30"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => move.mutate({ categoryId: category.id, direction: 'down' })}
              disabled={pending || isLast}
              title="Descendre"
              className="p-2 text-muted hover:text-ink disabled:opacity-30"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              title="Renommer"
              className="p-2 text-muted hover:text-ink disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setActive.mutate({
                  categoryId: category.id,
                  active: !category.active,
                })
              }
              disabled={pending}
              title={category.active ? 'Masquer' : 'Réafficher'}
              className="p-2 text-muted hover:text-ink disabled:opacity-50"
            >
              {category.active ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error.message}</p>}
    </div>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [draft, setDraft] = useState({ label: '', emoji: '', imageUrl: '' })

  const create = useMutation(
    trpc.admin.createCategory.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() })
        router.refresh()
        onDone()
      },
    }),
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate({
          label: draft.label.trim(),
          emoji: draft.emoji.trim() || undefined,
          imageUrl: draft.imageUrl.trim() || undefined,
        })
      }}
      className="bg-white rounded-2xl shadow-card border border-primary/30 p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Nouvelle catégorie</h3>
        <button type="button" onClick={onDone} className="text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <CategoryFields
        {...draft}
        onChange={(field, value) =>
          setDraft((prev) => ({ ...prev, [field]: value }))
        }
      />

      <p className="text-xs text-muted">
        L&apos;adresse est dérivée du libellé et <strong>ne changera plus</strong>{' '}
        ensuite : elle vit dans les liens de recherche partagés.
      </p>

      {create.error && (
        <p className="text-red-500 text-sm">{create.error.message}</p>
      )}

      <button
        type="submit"
        disabled={create.isPending || draft.label.trim().length < 2}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
      >
        {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Créer
      </button>
    </form>
  )
}

export default function AdminCategoriesPage() {
  const trpc = useTRPC()
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useQuery(trpc.admin.categories.queryOptions())

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-body font-bold text-3xl text-ink">Catégories</h1>
          <p className="text-muted mt-1">
            Ce que les touristes voient dans les filtres et sur l&apos;accueil,
            et ce que les opérateurs peuvent choisir.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouvelle catégorie
          </button>
        )}
      </header>

      <div className="space-y-4">
        {creating && <CreateForm onDone={() => setCreating(false)} />}

        {isLoading || !data ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl h-20 animate-pulse border border-muted/10"
            />
          ))
        ) : (
          <>
            {data.map((category, i) => (
              <CategoryRow
                key={category.id}
                category={category}
                isFirst={i === 0}
                isLast={i === data.length - 1}
              />
            ))}

            <p className="text-xs text-muted pt-2">
              Une catégorie ne se supprime pas : les activités qui la
              référencent en dépendent. La <strong>masquer</strong> la retire des
              filtres et du formulaire opérateur sans toucher aux activités déjà
              classées dedans.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

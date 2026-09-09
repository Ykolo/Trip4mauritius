'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { ImageDropzone } from '@/components/forms/ImageDropzone'
import { useTRPC } from '@/lib/trpc/client'
import type { GuideAdminDetail, GuideStatus } from '@/types/guide'

// Éditeur d'article — le même formulaire pour créer et pour corriger.
//
// Deux formulaires jumeaux auraient divergé au premier champ ajouté, et l'un
// des deux aurait cessé d'enregistrer ce que l'autre saisit.

interface FormState {
  title: string
  excerpt: string
  content: string
  categoryId: string
  imageUrls: string[]
  status: GuideStatus
}

// `status` typé sur l'union et non figé à `'draft'` : sans ça, cocher
// « Publier » ne compilait pas.
const EMPTY: FormState = {
  title: '',
  excerpt: '',
  content: '',
  categoryId: '',
  imageUrls: [],
  status: 'draft',
}

export function GuideEditor({ guide }: { guide?: GuideAdminDetail }) {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormState>(guide ?? EMPTY)
  const [error, setError] = useState<string | null>(null)

  const { data: categories } = useQuery(
    trpc.admin.guideCategories.queryOptions(),
  )
  // Une catégorie désactivée reste proposée si l'article y est déjà classé :
  // sinon, ouvrir la fiche viderait le champ et l'enregistrement échouerait
  // sans que l'admin comprenne pourquoi.
  const options = (categories ?? []).filter(
    (c) => c.active || c.id === form.categoryId,
  )

  const done = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.guides.queryKey() })
    router.push('/admin/guides')
  }

  const create = useMutation(
    trpc.admin.createGuide.mutationOptions({
      onSuccess: done,
      onError: (e) => setError(e.message),
    }),
  )
  const update = useMutation(
    trpc.admin.updateGuide.mutationOptions({
      onSuccess: done,
      onError: (e) => setError(e.message),
    }),
  )
  const remove = useMutation(
    trpc.admin.deleteGuide.mutationOptions({
      onSuccess: done,
      onError: (e) => setError(e.message),
    }),
  )

  const pending = create.isPending || update.isPending || remove.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const data = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      categoryId: form.categoryId,
      imageUrls: form.imageUrls,
      status: form.status,
    }

    if (guide) update.mutate({ guideId: guide.id, data })
    else create.mutate(data)
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/admin/guides"
        className="inline-flex items-center gap-2 text-muted text-sm mb-6 hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Tous les guides
      </Link>

      <h1 className="font-body font-bold text-3xl text-ink mb-6">
        {guide ? 'Modifier l’article' : 'Nouvel article'}
      </h1>

      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-sm text-muted">Titre</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {guide && (
            // Le slug est figé : le déplacer casserait les liens déjà partagés.
            <span className="text-xs text-muted mt-1 block">
              Adresse : /guide/{guide.slug} — inchangée même si le titre bouge.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-muted">Catégorie</span>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Choisir…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <span className="text-xs text-red-600 mt-1 block">
              Aucune catégorie. Créez-en une depuis la liste des guides.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-muted">Chapô</span>
          <textarea
            required
            maxLength={500}
            rows={2}
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            placeholder="L’accroche affichée dans les listes."
            className="mt-1 w-full px-3 py-2 rounded-xl border border-muted/30 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted">Article</span>
          <textarea
            required
            maxLength={50000}
            rows={16}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder={'## Un sous-titre\n\nLe corps de l’article. Le Markdown est accepté.'}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-muted/30 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div>
          <span className="text-sm text-muted">Images</span>

          {/* La liste d'URLs en texte a disparu au profit de la zone
              pointillée : elle affichait des adresses que personne ne relit,
              là où l'auteur d'un article veut voir SES photos. La saisie
              d'adresse reste, repliée dans le composant — c'est le seul chemin
              qui fonctionne tant que le stockage Blob n'est pas provisionné. */}
          <div className="mt-2">
            <ImageDropzone
              value={form.imageUrls}
              onChange={(next) => setForm((f) => ({ ...f, imageUrls: next }))}
              max={10}
              hint="La première image sert de couverture à l’article."
            />
          </div>
        </div>

        <label className="flex items-center gap-3 bg-white rounded-xl border border-muted/20 px-4 py-3">
          <input
            type="checkbox"
            checked={form.status === 'published'}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.checked ? 'published' : 'draft',
              })
            }
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm">
            <strong className="text-ink">Publier</strong>
            <span className="text-muted"> — visible immédiatement sur /guide.</span>
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>

          {guide && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // Un article n'a aucune dépendance : le supprimer n'orpheline
                // rien, contrairement à une activité déjà réservée.
                if (confirm(`Supprimer définitivement « ${guide.title} » ?`)) {
                  remove.mutate({ guideId: guide.id })
                }
              }}
              className="inline-flex items-center gap-2 text-red-600 font-medium px-4 py-3 rounded-xl hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

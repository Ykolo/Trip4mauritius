'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Eye, EyeOff, Loader2, Plus, Tags } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'

// Guides éditoriaux — articles et classification sur le même écran.
//
// Les deux vivent ensemble parce qu'on ne crée pas un article sans avoir une
// catégorie où le ranger : les séparer en deux onglets obligerait à faire
// l'aller-retour dès la première rédaction.

function GuideCategories() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.admin.guideCategories.queryKey(),
    })
    queryClient.invalidateQueries({ queryKey: trpc.admin.guides.queryKey() })
  }

  const { data: categories } = useQuery(
    trpc.admin.guideCategories.queryOptions(),
  )
  const create = useMutation(
    trpc.admin.createGuideCategory.mutationOptions({
      onSuccess: () => {
        setLabel('')
        setError(null)
        invalidate()
      },
      onError: (e) => setError(e.message),
    }),
  )
  const setActive = useMutation(
    trpc.admin.setGuideCategoryActive.mutationOptions({ onSuccess: invalidate }),
  )

  return (
    <section className="bg-white rounded-2xl shadow-card p-6 mb-6">
      <h2 className="flex items-center gap-2 font-semibold text-ink mb-1">
        <Tags className="w-4 h-4" /> Classification
      </h2>
      <p className="text-sm text-muted mb-4">
        Gastronomie, sécurité, stationnement… Le libellé se renomme,
        l&apos;adresse non : elle vit dans les liens partagés.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          create.mutate({ label })
        }}
        className="flex gap-2 mb-4"
      >
        <input
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nouvelle catégorie"
          className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-4 rounded-xl disabled:opacity-60 whitespace-nowrap"
        >
          {create.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Ajouter
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {categories && categories.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-2 rounded-full pl-4 pr-2 py-1.5 text-sm ${
                c.active
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/15 text-muted line-through'
              }`}
            >
              <span>
                {c.label}
                <span className="opacity-60"> · {c.guideCount}</span>
              </span>
              {/* On désactive, on ne supprime pas : la clé étrangère est en
                  RESTRICT et les articles déjà classés doivent survivre. */}
              <button
                onClick={() =>
                  setActive.mutate({ categoryId: c.id, active: !c.active })
                }
                aria-label={c.active ? `Masquer ${c.label}` : `Réactiver ${c.label}`}
                className="p-1 rounded-full hover:bg-black/5"
              >
                {c.active ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function AdminGuidesPage() {
  const trpc = useTRPC()
  const { data: guides, isLoading } = useQuery(trpc.admin.guides.queryOptions())

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-body font-bold text-3xl text-ink">Guides</h1>
          <p className="text-muted mt-1">
            Les articles publiés sur le site.
          </p>
        </div>
        <Link
          href="/admin/guides/nouveau"
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Nouvel article
        </Link>
      </header>

      <GuideCategories />

      {isLoading || !guides ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : guides.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <BookOpen className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">
            Aucun article. Créez une catégorie, puis votre premier guide.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {guides.map((guide) => (
            <li key={guide.id}>
              <Link
                href={`/admin/guides/${guide.id}`}
                className="bg-white rounded-2xl shadow-card p-5 flex items-center justify-between gap-4 hover:border-primary/40 border border-transparent transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {guide.title}
                  </p>
                  <p className="text-sm text-muted truncate">
                    {guide.category} · modifié le{' '}
                    {new Date(guide.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    guide.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-muted/20 text-muted'
                  }`}
                >
                  {guide.status === 'published' ? 'En ligne' : 'Brouillon'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import {
  getPublishedGuide,
  listPublishedGuideSlugs,
} from '@/server/services/guide'

// Composant SERVEUR, comme les fiches d'activité : un article existe pour être
// lu et indexé. Le service ne renvoie QUE les `published` — un brouillon n'est
// pas chargé du tout, même pour être écarté ensuite.

export async function generateStaticParams() {
  const slugs = await listPublishedGuideSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)

  if (!guide) return { title: 'Article introuvable — Trip4mauritius' }

  return {
    title: `${guide.title} — Trip4mauritius`,
    description: guide.excerpt,
    openGraph: {
      title: guide.title,
      description: guide.excerpt,
      images: guide.imageUrl ? [guide.imageUrl] : undefined,
    },
  }
}

/**
 * Rendu minimal du Markdown : titres, paragraphes, listes.
 *
 * Volontairement sans bibliothèque. Le contenu est écrit par Trip4mauritius —
 * pas par un tiers — mais il n'est PAS injecté en HTML brut pour autant : tout
 * passe par du texte React, donc rien de ce qui est saisi ne peut s'exécuter.
 * Un `dangerouslySetInnerHTML` aurait fait de l'éditeur une porte ouverte le
 * jour où un autre rôle y accède.
 */
function Markdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/)

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="text-lg font-semibold text-ink mt-6">
              {trimmed.slice(4)}
            </h3>
          )
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="text-2xl font-semibold text-ink mt-8">
              {trimmed.slice(3)}
            </h2>
          )
        }

        const lines = trimmed.split('\n')
        if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => (
                <li key={j} className="text-muted leading-relaxed">
                  {l.trim().replace(/^[-*]\s+/, '')}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={i} className="text-muted leading-relaxed whitespace-pre-line">
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)

  if (!guide) notFound()

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/guide"
        className="inline-flex items-center gap-2 text-muted text-sm mb-6 hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Le guide
      </Link>

      <header className="mb-6">
        <Link
          href={`/guide?categorie=${guide.categorySlug}`}
          className="text-xs font-medium text-primary uppercase tracking-wide"
        >
          {guide.category}
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-ink mt-2 mb-3">
          {guide.title}
        </h1>
        <p className="text-muted text-lg leading-relaxed">{guide.excerpt}</p>
      </header>

      {guide.imageUrl && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-[16/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={guide.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <Markdown content={guide.content} />

      {/* Les images suivantes closent l'article : les intercaler demanderait
          une syntaxe de placement que l'éditeur n'offre pas encore. */}
      {guide.imageUrls.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          {guide.imageUrls.slice(1).map((url, i) => (
            <div key={`${url}-${i}`} className="rounded-2xl overflow-hidden aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-primary/5 p-6 text-center">
        <p className="text-sm text-muted mb-4">
          Envie de passer à la pratique ?
        </p>
        <Link
          href="/activities"
          className="inline-block px-6 py-3 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          Parcourir les activités
        </Link>
      </div>
    </article>
  )
}

import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import {
  listActiveGuideCategories,
  listPublishedGuides,
} from '@/server/services/guide'

// Composant SERVEUR : c'est une page éditoriale, son intérêt est d'être
// indexable.
//
// Elle ne contient plus AUCUN texte en dur. « Quand partir », « Choisir sa
// région » et « Informations pratiques » étaient trois tableaux de constantes
// ici même : de l'éditorial que le back-office listait comme administrable et
// que personne ne pouvait pourtant modifier sans redéployer. Ce sont désormais
// des articles ordinaires, créés par le seed et modifiables depuis
// `/admin/guides` comme les autres.
//
// Les renvois vers le catalogue filtré vivent donc maintenant dans le Markdown
// des articles. Ils utilisent les mêmes paramètres d'URL que `/activities` —
// `?region=North`, la valeur stockée, jamais le libellé français : un lien qui
// ne correspondrait à aucun filtre réel donnerait une page vide.

export const metadata: Metadata = {
  title: 'Guide de l’île Maurice — Trip4mauritius',
  description:
    "Quand partir, quelle région choisir, combien prévoir : le guide pratique pour préparer son séjour à l'île Maurice et réserver ses activités.",
}

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>
}) {
  // Le filtre voyage par SLUG dans l'URL — c'est lui qui est partagé et
  // indexé. Le libellé, lui, n'est qu'affiché.
  const { categorie } = await searchParams

  const [categories, guides] = await Promise.all([
    listActiveGuideCategories(),
    listPublishedGuides(categorie),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      <header>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
          Guide de l&rsquo;île Maurice
        </h1>
        <p className="text-muted">
          Ce qu&rsquo;il faut savoir avant de réserver : quand venir, où loger, et à quoi
          s&rsquo;attendre région par région.
        </p>
      </header>

      <section>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <Link
              href="/guide"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categorie
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-primary text-white'
              }`}
            >
              Tout
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/guide?categorie=${c.slug}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  categorie === c.slug
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}

        {guides.length === 0 ? (
          <p className="text-muted text-sm">
            {categorie
              ? 'Aucun article dans cette catégorie pour le moment.'
              : 'Aucun article publié pour le moment.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Pas d'`items-start` : les cartes s'étirent à la hauteur de leur
                rangée, donc les bas s'alignent. L'étirement n'était pas le
                problème — il ne devient laid que s'il étire du VIDE, ce que le
                bandeau ci-dessous empêche désormais. Il ne reste à répartir que
                l'écart de longueur des chapôs. */}
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className="rounded-2xl bg-white shadow-card overflow-hidden group"
              >
                {/* Le bandeau 16/9 est rendu MÊME sans image.
                    Il ne l'était pas, et une carte sans couverture s'étirait
                    quand même à la hauteur de sa voisine — 260 px de blanc sous
                    trois lignes de texte. L'image est facultative à la saisie ;
                    tant qu'elle l'est, son absence doit se voir comme un choix
                    et non comme un trou. */}
                <div className="relative aspect-[16/9] overflow-hidden bg-primary/5">
                  {guide.imageUrl ? (
                    <>
                      {/* `img` et non `next/image` : l'URL est saisie par l'admin,
                          donc de domaine imprévisible, et `images.unoptimized`
                          est déjà posé pour le reste du site. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={guide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </>
                  ) : (
                    <div
                      aria-hidden
                      className="w-full h-full flex items-center justify-center"
                    >
                      <BookOpen className="w-8 h-8 text-primary/25" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">
                    {guide.category}
                  </span>
                  <h3 className="font-semibold text-ink mt-1 mb-2">
                    {guide.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed line-clamp-3">
                    {guide.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-primary/5 p-6 text-center">
        <h2 className="text-xl font-semibold text-ink mb-2">Prêt à réserver ?</h2>
        <p className="text-sm text-muted mb-4">
          Toutes nos activités sont opérées par des prestataires locaux vérifiés.
        </p>
        <Link
          href="/activities"
          className="inline-block px-6 py-3 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          Parcourir le catalogue
        </Link>
      </section>
    </div>
  )
}

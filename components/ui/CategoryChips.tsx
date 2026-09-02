'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

// Les catégories viennent de la base, plus d'une liste en dur.
//
// Cette liste-ci pointait sur des slugs (`diving`, `mer`, `terre`, `air`,
// `nautique`) qu'AUCUNE activité ne portait : la base contenait « Water
// Sports », « Nature », « Cruises ». Les vignettes de l'accueil renvoyaient
// donc systématiquement un catalogue vide — sauf « Véhicules », seul slug qui
// coïncidait par hasard avec un libellé.

// Plus de `useSearchParams()` ici. Il ne servait qu'à surligner la catégorie
// active — or ce composant n'est rendu que sur l'accueil, dont l'URL ne porte
// jamais `?category`. Le surlignage était donc mort, mais il forçait une
// frontière `<Suspense>` autour du composant, et cette frontière ne se
// résolvait pas : son contenu restait parqué à la racine du <body>, jamais
// hydraté. Les vignettes ne s'affichaient donc jamais.

/** Repli quand la catégorie n'a pas d'illustration : le dégradé seul reste lisible. */
const FALLBACK_IMAGE = '/images/regions/north.jpg'

export function CategoryChips() {
  const trpc = useTRPC()
  const { data: categories, isLoading } = useQuery(
    trpc.activity.categories.queryOptions(),
  )

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="min-w-[124px] md:min-w-[140px] aspect-[4/5] rounded-3xl bg-surface animate-pulse shrink-0"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!categories?.length) return null

  return (
    <div className="w-full">
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
        {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/activities?category=${cat.slug}`}
              className="group relative min-w-[124px] md:min-w-[140px] aspect-[4/5] rounded-3xl overflow-hidden snap-start transition-all duration-300 hover:-translate-y-1 shadow-card hover:shadow-lg"
            >
              <Image
                src={cat.imageUrl || FALLBACK_IMAGE}
                alt={cat.label}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Gradient Overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

              <div className="absolute flex flex-col items-center flex-end bottom-0 left-0 right-0 p-4 shrink-0">
                {cat.emoji && (
                  <span className="text-2xl lg:text-3xl mb-1.5 drop-shadow-md transform transition-transform group-hover:-translate-y-1">
                    {cat.emoji}
                  </span>
                )}
                <span className="font-display font-semibold text-white text-sm lg:text-base text-center tracking-tight drop-shadow-sm">
                  {cat.label}
                </span>
              </div>
            </Link>
        ))}
      </div>
    </div>
  )
}

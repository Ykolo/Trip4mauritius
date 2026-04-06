'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { emoji: '🤿', label: 'Plongée', slug: 'diving', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80' },
  { emoji: '⛵', label: 'La Mer', slug: 'mer', image: 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=400&q=80' },
  { emoji: '🥾', label: 'Terre', slug: 'terre', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80' },
  { emoji: '🦅', label: 'Aérien', slug: 'air', image: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=400&q=80' },
  { emoji: '🍹', label: 'Saveurs', slug: 'gastronomie', image: 'https://images.unsplash.com/photo-1597075687490-8f673c6c17f6?w=400&q=80' },
  { emoji: '🛶', label: 'Nautisme', slug: 'nautique', image: 'https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=400&q=80' },
  { emoji: '🚗', label: 'Véhicules', slug: 'Véhicules', image: '/images/vehicles/jeep_wrangler_1775498501364.png' },
] as const

export function CategoryChips() {
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')

  return (
    <div className="w-full">
      {/* Scrollable image cards for all platforms */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.slug
          return (
            <Link
              key={cat.slug}
              href={`/activities?category=${cat.slug}`}
              className={`
                group relative min-w-[124px] md:min-w-[140px] aspect-[4/5] rounded-3xl overflow-hidden snap-start transition-all duration-300
                ${isActive ? 'ring-[3px] ring-primary ring-offset-2 scale-[0.98]' : 'hover:-translate-y-1 shadow-card hover:shadow-lg'}
              `}
            >
              <Image
                src={cat.image}
                alt={cat.label}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Gradient Overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
              
              <div className="absolute flex flex-col items-center flex-end bottom-0 left-0 right-0 p-4 shrink-0">
                <span className="text-2xl lg:text-3xl mb-1.5 drop-shadow-md transform transition-transform group-hover:-translate-y-1">{cat.emoji}</span>
                <span className="font-display font-semibold text-white text-sm lg:text-base text-center tracking-tight drop-shadow-sm">{cat.label}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMBAAAAAAAAAAAAAQIDBAAFEQYSITETQVEU/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEEQA/8AEu5zW7dZEOMpUVbXFKccJJOEgDgD0Kz+x3e4W2E4y08RK3LQkk4z6Pz5SlKpWKxTMlROJ//Z'

const REGIONS = ['Toutes les régions', 'Nord', 'Sud', 'Est', 'Ouest', 'Centre'] as const

export function HeroSection() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [region, setRegion] = useState<string>('Toutes les régions')

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (keyword) params.set('q', keyword)
    if (region && region !== 'Toutes les régions') params.set('region', region)
    router.push(`/activities?${params.toString()}`)
  }

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <Image
        src="/images/hero.jpg"
        alt="Mauritius turquoise lagoon"
        fill
        priority
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover"
      />
      
      {/* Glassmorphism Overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/20" />
      
      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-4xl mx-auto px-4 text-center"
      >
        <h1 className="font-display text-4xl md:text-6xl text-white drop-shadow-lg mb-4">
          Découvrez l'Île Maurice Autrement
        </h1>
        <p className="font-sans font-light text-white/90 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
          Réservez des expériences uniques avec les meilleurs guides locaux
        </p>
        
        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-card p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            {/* Keyword Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                placeholder="Activité ou mot-clé..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* Region Select */}
            <div className="md:w-40">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-base text-ink focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            {/* Search Button */}
            <button
              onClick={handleSearch}
              className="h-12 bg-primary text-white rounded-2xl px-6 py-3 font-semibold active:scale-95 transition-transform hover:bg-primary-light min-w-[140px]"
            >
              Rechercher
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

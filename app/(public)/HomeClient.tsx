'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, Trophy, Zap } from 'lucide-react'

import { HeroSection } from '@/components/ui/HeroSection'
import { CategoryChips } from '@/components/ui/CategoryChips'
import { ActivityCard } from '@/components/ui/ActivityCard'
import type { Activity } from '@/types/activity'
import type { GuideSummary } from '@/types/guide'

// Stub for SEO component (Step 6)
function OrganizationSchema() {
  return <></>
}

const REGIONS = [
  { name: 'North', image: '/images/regions/north.jpg' },
  { name: 'South', image: '/images/regions/south.jpg' },
  { name: 'East', image: '/images/regions/east.jpg' },
  { name: 'West', image: '/images/regions/west.jpg' },
  { name: 'Centre', image: '/images/regions/centre.jpg' },
]



const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMBAAAAAAAAAAAAAQIDBAAFEQYSITETQVEU/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEQA/8AEu5zW7dZEOMpUVbXFKccJJOEgDgD0Kz+x3e4W2E4y08RK3LQkk4z6Pz5SlKpWKxTMlROJ//Z'

const sectionVariants: any = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

export function HomeClient({
  featured,
  guides,
}: {
  featured: Activity[]
  guides: GuideSummary[]
}) {
  return (
    <>
      <OrganizationSchema />
      
      {/* Hero */}
      <HeroSection />
      
      {/* Popular Categories */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="py-6 px-4 max-w-7xl mx-auto"
      >
        <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-4">
          Catégories Populaires
        </h2>
        <CategoryChips />
      </motion.section>
      
      {/* Featured Activities */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="py-6 px-4 max-w-7xl mx-auto"
      >
        <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-4">
          Activités en Vedette
        </h2>
        {featured.length === 0 ? (
          // Le catalogue peut être vide (base neuve, tout en modération). Mieux
          // vaut le dire que d'afficher une bande blanche sans explication.
          <p className="text-muted text-sm">
            Aucune activité publiée pour le moment.{' '}
            <Link href="/activities" className="text-primary underline">
              Voir le catalogue
            </Link>
          </p>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {featured.map((activity) => (
              <div key={activity.slug} className="min-w-[300px] max-w-[300px] snap-start">
                <ActivityCard activity={activity} />
              </div>
            ))}
          </div>
        )}
      </motion.section>
      
      {/* Explore by Region */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="py-6 px-4 max-w-7xl mx-auto"
      >
        <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-4">
          Explorer par Région
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {REGIONS.map((region) => (
            <Link
              key={region.name}
              href={`/activities?region=${region.name}`}
              className="relative aspect-[4/3] rounded-2xl overflow-hidden group"
            >
              <Image
                src={region.image}
                alt={`${region.name} Mauritius`}
                fill
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-4 left-4 text-white font-semibold text-lg">
                {region.name}
              </span>
            </Link>
          ))}
        </div>
      </motion.section>
      
      {/* Les articles venaient d'un tableau écrit en dur dont les liens
          pointaient vers /blog/…, une route qui n'existe pas : chaque clic
          donnait un 404. Ils viennent maintenant des guides, et la section
          disparaît quand il n'y en a aucun plutôt que de promettre du vide. */}
      {guides.length > 0 && (
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="py-6 px-4 max-w-7xl mx-auto mb-4"
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-semibold text-ink">
              Le guide de l&rsquo;île
            </h2>
            <Link href="/guide" className="text-sm text-primary font-medium">
              Tout voir
            </Link>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className="block group min-w-[260px] max-w-[260px] snap-start"
              >
                <div className="rounded-2xl shadow-card overflow-hidden bg-white transition-transform group-hover:scale-[1.02] h-full">
                  {guide.imageUrl && (
                    <div className="relative aspect-[4/3]">
                      {/* `img` et non `next/image` : l'URL est saisie par
                          l'admin, donc de domaine imprévisible. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={guide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 left-3 bg-primary/90 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {guide.category}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-ink text-sm mb-1 line-clamp-2">
                      {guide.title}
                    </h3>
                    <p className="text-[11px] text-muted line-clamp-2">
                      {guide.excerpt}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}
    </>
  )
}

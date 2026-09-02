'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, Trophy, Zap } from 'lucide-react'

import { HeroSection } from '@/components/ui/HeroSection'
import { CategoryChips } from '@/components/ui/CategoryChips'
import { ActivityCard } from '@/components/ui/ActivityCard'
import type { Activity } from '@/types/activity'

// Stub for SEO component (Step 6)
function OrganizationSchema() {
  return <></>
}

// Mock data
const FEATURED_ACTIVITIES: Activity[] = [
  {
    id: '1',
    slug: 'le-morne-hiking',
    title: 'Randonnée Guidée au Morne Brabant',
    category: 'Terre',
    categorySlug: 'nature',
    region: 'South',
    duration: '4 heures',
    priceFrom: 45,
    imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
    rating: 4.9,
    lang: ['fr', 'en'],
  },
  {
    id: '2',
    slug: 'helicopter-underwater-waterfall',
    title: 'Survol Immergé : Cascade Sous-Marine',
    category: 'Air',
    categorySlug: 'aventure',
    region: 'South',
    duration: '45 min',
    priceFrom: 340,
    imageUrl: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&q=80',
    rating: 5.0,
    lang: ['fr', 'en'],
  },
  {
    id: '3',
    slug: 'kitesurf-le-morne',
    title: 'Session Kitesurf Lagon Bel Ombre',
    category: 'Nautique',
    categorySlug: 'sports-nautiques',
    region: 'South',
    duration: '2 heures',
    priceFrom: 110,
    imageUrl: 'https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=600&q=80',
    rating: 4.8,
    lang: ['fr', 'en'],
  },
  {
    id: '4',
    slug: 'rhumerie-chamarel-tasting',
    title: 'Dégustation Rhumerie de Chamarel',
    category: 'Gastronomie',
    categorySlug: 'gastronomie',
    region: 'Centre',
    duration: '1.5 heures',
    priceFrom: 35,
    imageUrl: 'https://images.unsplash.com/photo-1597075687490-8f673c6c17f6?w=600&q=80',
    rating: 4.7,
    lang: ['fr', 'en'],
  },
  {
    id: '5',
    slug: 'catamaran-ile-aux-cerfs-premium',
    title: 'Catamaran Premium à l\'Île aux Cerfs',
    category: 'Mer',
    categorySlug: 'croisieres',
    region: 'East',
    duration: 'Journée',
    priceFrom: 85,
    imageUrl: 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=600&q=80',
    rating: 4.6,
    lang: ['fr', 'en'],
  },
]

const REGIONS = [
  { name: 'North', image: '/images/regions/north.jpg' },
  { name: 'South', image: '/images/regions/south.jpg' },
  { name: 'East', image: '/images/regions/east.jpg' },
  { name: 'West', image: '/images/regions/west.jpg' },
  { name: 'Centre', image: '/images/regions/centre.jpg' },
]



const BLOG_POSTS = [
  {
    slug: 'best-beaches-mauritius',
    title: 'Top 10 Hidden Beaches in Mauritius',
    excerpt: 'Discover the most secluded and stunning beaches that most tourists never find. From secret coves to pristine lagoons.',
    category: 'Travel Tips',
    readTime: '5 min read',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  },
  {
    slug: 'mauritius-food-guide',
    title: 'A Foodie\'s Guide to Mauritian Cuisine',
    excerpt: 'From street food dholl puri to fine dining seafood, explore the rich culinary heritage of this island paradise.',
    category: 'Food & Culture',
    readTime: '7 min read',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },
  {
    slug: 'underwater-waterfall',
    title: 'The Illusion of the Underwater Waterfall',
    excerpt: 'Learn about one of nature\'s most spectacular optical illusions found off the coast of Le Morne peninsula.',
    category: 'Nature',
    readTime: '4 min read',
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&q=80',
  },
]

const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMBAAAAAAAAAAAAAQIDBAAFEQYSITETQVEU/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEQA/8AEu5zW7dZEOMpUVbXFKccJJOEgDgD0Kz+x3e4W2E4y08RK3LQkk4z6Pz5SlKpWKxTMlROJ//Z'

const sectionVariants: any = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

export default function HomePage() {
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
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {FEATURED_ACTIVITIES.map((activity) => (
            <div key={activity.slug} className="min-w-[300px] max-w-[300px] snap-start">
              <ActivityCard activity={activity} />
            </div>
          ))}
        </div>
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
      
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="py-6 px-4 max-w-7xl mx-auto mb-4"
      >
        <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-4">
          Derniers Articles
        </h2>
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group min-w-[260px] max-w-[260px] snap-start"
            >
              <div className="rounded-2xl shadow-card overflow-hidden bg-white transition-transform group-hover:scale-[1.02]">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover"
                  />
                  <span className="absolute top-3 left-3 bg-primary/90 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                    {post.category}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-ink text-sm mb-1 line-clamp-2">
                    {post.title}
                  </h3>
                  <span className="text-[11px] text-muted">{post.readTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>
    </>
  )
}

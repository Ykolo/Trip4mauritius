'use client'

import { useState, useEffect } from 'react'
import type { Activity, ActivityFilters, ActivitiesResponse } from '@/types/activity'

// Mock data for activities
const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    slug: 'catamaran-cruise-ile-aux-cerfs',
    title: 'Catamaran Cruise to Ile aux Cerfs',
    category: 'Water Sports',
    region: 'East',
    duration: 'Full day',
    priceFrom: 89,
    imageUrl: '/images/regions/east.jpg',
    rating: 4.8,
    lang: ['EN', 'FR', 'DE']
  },
  {
    id: '2',
    slug: 'le-morne-hiking-tour',
    title: 'Le Morne Mountain Hiking Tour',
    category: 'Nature',
    region: 'West',
    duration: 'Half day',
    priceFrom: 65,
    imageUrl: '/images/regions/west.jpg',
    rating: 4.9,
    lang: ['EN', 'FR']
  },
  {
    id: '3',
    slug: 'grand-baie-sunset-cruise',
    title: 'Grand Baie Sunset Cruise',
    category: 'Cruises',
    region: 'North',
    duration: '< 2h',
    priceFrom: 55,
    imageUrl: '/images/regions/north.jpg',
    rating: 4.7,
    lang: ['EN', 'FR', 'DE', 'ES']
  },
  {
    id: '4',
    slug: 'black-river-gorges-trek',
    title: 'Black River Gorges Trekking',
    category: 'Nature',
    region: 'Centre',
    duration: 'Full day',
    priceFrom: 75,
    imageUrl: '/images/regions/centre.jpg',
    rating: 4.6,
    lang: ['EN', 'FR']
  },
  {
    id: '5',
    slug: 'gris-gris-coastal-tour',
    title: 'Gris Gris Coastal Discovery',
    category: 'Tours',
    region: 'South',
    duration: 'Half day',
    priceFrom: 45,
    imageUrl: '/images/regions/south.jpg',
    rating: 4.5,
    lang: ['EN', 'FR']
  },
  {
    id: '6',
    slug: 'dolphin-swimming-adventure',
    title: 'Dolphin Swimming Adventure',
    category: 'Water Sports',
    region: 'West',
    duration: 'Half day',
    priceFrom: 95,
    imageUrl: '/images/regions/west.jpg',
    rating: 4.9,
    lang: ['EN', 'FR', 'DE']
  },
  {
    id: '7',
    slug: 'port-louis-cultural-tour',
    title: 'Port Louis Cultural Walking Tour',
    category: 'Culture',
    region: 'North',
    duration: '< 2h',
    priceFrom: 35,
    imageUrl: '/images/regions/north.jpg',
    rating: 4.4,
    lang: ['EN', 'FR', 'ES']
  },
  {
    id: '8',
    slug: 'mauritius-food-tour',
    title: 'Street Food Culinary Experience',
    category: 'Food & Drink',
    region: 'North',
    duration: 'Half day',
    priceFrom: 60,
    imageUrl: '/images/regions/north.jpg',
    rating: 4.8,
    lang: ['EN', 'FR']
  },
  {
    id: '9',
    slug: 'quad-biking-south',
    title: 'Quad Biking South Coast',
    category: 'Adventure',
    region: 'South',
    duration: '< 2h',
    priceFrom: 85,
    imageUrl: '/images/regions/south.jpg',
    rating: 4.6,
    lang: ['EN', 'FR', 'DE']
  },
  {
    id: '10',
    slug: 'spa-wellness-retreat',
    title: 'Luxury Spa & Wellness Day',
    category: 'Wellness',
    region: 'East',
    duration: 'Full day',
    priceFrom: 150,
    imageUrl: '/images/regions/east.jpg',
    rating: 4.9,
    lang: ['EN', 'FR', 'DE', 'RU']
  },
  {
    id: '11',
    slug: 'underwater-sea-walk',
    title: 'Underwater Sea Walk Experience',
    category: 'Water Sports',
    region: 'North',
    duration: '< 2h',
    priceFrom: 75,
    imageUrl: '/images/regions/north.jpg',
    rating: 4.7,
    lang: ['EN', 'FR']
  },
  {
    id: '12',
    slug: 'chamarel-seven-colored-earth',
    title: 'Chamarel Seven Colored Earth Tour',
    category: 'Nature',
    region: 'South',
    duration: 'Half day',
    priceFrom: 50,
    imageUrl: '/images/regions/south.jpg',
    rating: 4.5,
    lang: ['EN', 'FR', 'DE', 'ES']
  }
]

const ITEMS_PER_PAGE = 8

export function useActivities(filters: ActivityFilters) {
  const [data, setData] = useState<ActivitiesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setIsLoading(true)
    
    // Simulate API delay
    const timer = setTimeout(() => {
      try {
        let filtered = [...MOCK_ACTIVITIES]

        // Apply region filter
        if (filters.region && filters.region.length > 0) {
          filtered = filtered.filter(a => filters.region!.includes(a.region))
        }

        // Apply category filter
        if (filters.category && filters.category.length > 0) {
          filtered = filtered.filter(a => filters.category!.includes(a.category))
        }

        // Apply price filter
        if (filters.minPrice !== undefined) {
          filtered = filtered.filter(a => a.priceFrom >= filters.minPrice!)
        }
        if (filters.maxPrice !== undefined) {
          filtered = filtered.filter(a => a.priceFrom <= filters.maxPrice!)
        }

        // Apply duration filter
        if (filters.duration && filters.duration !== 'Any') {
          filtered = filtered.filter(a => a.duration === filters.duration)
        }

        // Apply language filter
        if (filters.lang && filters.lang.length > 0) {
          filtered = filtered.filter(a => 
            filters.lang!.some(l => a.lang.includes(l))
          )
        }

        // Pagination
        const page = filters.page || 1
        const total = filtered.length
        const pages = Math.ceil(total / ITEMS_PER_PAGE)
        const start = (page - 1) * ITEMS_PER_PAGE
        const activities = filtered.slice(start, start + ITEMS_PER_PAGE)

        setData({ activities, total, pages })
        setError(null)
      } catch (e) {
        setError(e as Error)
      } finally {
        setIsLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [
    filters.region?.join(','),
    filters.category?.join(','),
    filters.minPrice,
    filters.maxPrice,
    filters.duration,
    filters.lang?.join(','),
    filters.page
  ])

  return { data, isLoading, error }
}

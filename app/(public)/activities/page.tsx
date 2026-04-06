'use client'

import { useReducer, useEffect, useRef, useCallback, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { ActivityCard } from '@/components/ui/ActivityCard'
import { SkeletonGrid } from '@/components/ui/SkeletonCard'
import { FilterDrawer, FilterSidebar } from '@/components/ui/FilterDrawer'
import { useActivities } from '@/lib/hooks/useActivities'
import type { ActivityFilters } from '@/types/activity'

// SEO metadata is handled via generateMetadata in a separate file or layout
// For client component, we set document title via useEffect

type FilterAction =
  | { type: 'SET_REGION'; payload: string[] }
  | { type: 'SET_CATEGORY'; payload: string[] }
  | { type: 'SET_PRICE_RANGE'; payload: { min: number; max: number } }
  | { type: 'SET_DURATION'; payload: string | undefined }
  | { type: 'SET_LANG'; payload: string[] }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_ALL'; payload: ActivityFilters }
  | { type: 'RESET' }

function filterReducer(state: ActivityFilters, action: FilterAction): ActivityFilters {
  switch (action.type) {
    case 'SET_REGION':
      return { ...state, region: action.payload, page: 1 }
    case 'SET_CATEGORY':
      return { ...state, category: action.payload, page: 1 }
    case 'SET_PRICE_RANGE':
      return { ...state, minPrice: action.payload.min, maxPrice: action.payload.max, page: 1 }
    case 'SET_DURATION':
      return { ...state, duration: action.payload, page: 1 }
    case 'SET_LANG':
      return { ...state, lang: action.payload, page: 1 }
    case 'SET_PAGE':
      return { ...state, page: action.payload }
    case 'SET_ALL':
      return action.payload
    case 'RESET':
      return { page: 1 }
    default:
      return state
  }
}

function parseSearchParams(searchParams: URLSearchParams): ActivityFilters {
  const filters: ActivityFilters = { page: 1 }
  
  const region = searchParams.get('region')
  if (region) filters.region = region.split(',')
  
  const category = searchParams.get('category')
  if (category) filters.category = category.split(',')
  
  const minPrice = searchParams.get('minPrice')
  if (minPrice) filters.minPrice = Number(minPrice)
  
  const maxPrice = searchParams.get('maxPrice')
  if (maxPrice) filters.maxPrice = Number(maxPrice)
  
  const duration = searchParams.get('duration')
  if (duration) filters.duration = duration
  
  const lang = searchParams.get('lang')
  if (lang) filters.lang = lang.split(',')
  
  const page = searchParams.get('page')
  if (page) filters.page = Number(page)
  
  return filters
}

function filtersToSearchParams(filters: ActivityFilters): string {
  const params = new URLSearchParams()
  
  if (filters.region?.length) params.set('region', filters.region.join(','))
  if (filters.category?.length) params.set('category', filters.category.join(','))
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.duration) params.set('duration', filters.duration)
  if (filters.lang?.length) params.set('lang', filters.lang.join(','))
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  
  return params.toString()
}

function ActivitiesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [filters, dispatch] = useReducer(filterReducer, parseSearchParams(searchParams))
  
  // Debounced filters for price slider
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Mobile infinite scroll state
  const [allActivities, setAllActivities] = useState<typeof data.activities>([])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Set document title
  useEffect(() => {
    document.title = 'Activities in Mauritius — MauriExplore'
  }, [])
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Debounce filter changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 300)
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [filters])
  
  // Sync URL with filters
  useEffect(() => {
    const queryString = filtersToSearchParams(debouncedFilters)
    const newUrl = queryString ? `/activities?${queryString}` : '/activities'
    router.replace(newUrl, { scroll: false })
  }, [debouncedFilters, router])
  
  const { data, isLoading } = useActivities(debouncedFilters)
  
  // Handle infinite scroll accumulation for mobile
  useEffect(() => {
    if (data?.activities) {
      if (isMobile && filters.page && filters.page > 1) {
        setAllActivities(prev => [...prev, ...data.activities])
      } else {
        setAllActivities(data.activities)
      }
    }
  }, [data?.activities, filters.page, isMobile])
  
  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!isMobile || !sentinelRef.current || !data) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && data.pages > (filters.page || 1)) {
          dispatch({ type: 'SET_PAGE', payload: (filters.page || 1) + 1 })
        }
      },
      { threshold: 0.1 }
    )
    
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [isMobile, isLoading, data, filters.page])
  
  const handleFiltersChange = useCallback((newFilters: ActivityFilters) => {
    dispatch({ type: 'SET_ALL', payload: newFilters })
  }, [])
  
  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  
  const displayActivities = isMobile ? allActivities : (data?.activities || [])
  
  return (
    <div className="min-h-screen bg-base">
      {/* Mobile Filter Button */}
      <div className="lg:hidden sticky top-14 z-30 bg-base border-b border-surface px-4 py-3">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm text-sm font-medium text-ink"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {(filters.region?.length || filters.category?.length || filters.duration || filters.lang?.length) && (
            <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5">
              {(filters.region?.length || 0) + (filters.category?.length || 0) + (filters.duration ? 1 : 0) + (filters.lang?.length || 0)}
            </span>
          )}
        </button>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-ink">Activities in Mauritius</h1>
          {data && (
            <p className="text-muted mt-1">
              {data.total} {data.total === 1 ? 'activity' : 'activities'} found
            </p>
          )}
        </div>
        
        {/* Main Content */}
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <FilterSidebar filters={filters} onFiltersChange={handleFiltersChange} />
          </div>
          
          {/* Activity Grid */}
          <div>
            {isLoading && (!isMobile || filters.page === 1) ? (
              <SkeletonGrid count={8} />
            ) : displayActivities.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {displayActivities.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
                
                {/* Mobile: Infinite scroll sentinel */}
                {isMobile && data && data.pages > (filters.page || 1) && (
                  <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                    {isLoading && <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />}
                  </div>
                )}
                
                {/* Desktop: Pagination */}
                {!isMobile && data && data.pages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: data.pages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-10 h-10 rounded-full font-medium transition-colors ${
                          page === (filters.page || 1)
                            ? 'bg-primary text-white'
                            : 'bg-white text-ink hover:bg-surface'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted text-lg">No activities found matching your filters.</p>
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="mt-4 text-primary font-medium hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Filter Drawer */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  )
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    }>
      <ActivitiesContent />
    </Suspense>
  )
}

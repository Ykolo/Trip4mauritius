'use client'

export function SkeletonCard() {
  return (
    <div className="rounded-2xl shadow-card overflow-hidden bg-white">
      {/* Image skeleton */}
      <div className="relative aspect-video bg-gray-200 animate-pulse" />
      
      {/* Body */}
      <div className="p-4">
        {/* Title skeleton */}
        <div className="h-6 bg-gray-200 animate-pulse rounded-lg mb-2 w-3/4" />
        
        {/* Subtitle skeleton */}
        <div className="h-4 bg-gray-200 animate-pulse rounded-lg mb-4 w-1/2" />
        
        {/* Footer skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-5 bg-gray-200 animate-pulse rounded-lg w-20" />
          <div className="h-10 bg-gray-200 animate-pulse rounded-2xl w-24" />
        </div>
      </div>
    </div>
  )
}

interface SkeletonGridProps {
  count?: number
}

export function SkeletonGrid({ count = 8 }: SkeletonGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

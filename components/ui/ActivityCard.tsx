import Image from 'next/image'
import Link from 'next/link'
import { regionLabel } from '@/lib/regions'
import type { Activity } from '@/types/activity'

interface ActivityCardProps {
  activity: Activity
}

const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMBAAAAAAAAAAAAAQIDBAAFEQYSITETQVEU/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEQA/8AEu5zW7dZEOMpUVbXFKccJJOEgDgD0Kz+x3e4W2E4y08RK3LQkk4z6Pz5SlKpWKxTMlROJ//Z'

export function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <Link href={`/activities/${activity.slug}`} className="block group">
      <div className="rounded-2xl shadow-card overflow-hidden bg-white transition-transform group-hover:scale-[1.02]">
        {/* Image */}
        <div className="relative aspect-[4/3]">
          <Image
            src={activity.imageUrl}
            alt={activity.title}
            fill
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
          {/* Category Badge */}
          <span className="absolute top-2 left-2 bg-white text-ink text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-sm">
            {activity.category}
          </span>
        </div>
        
        {/* Body */}
        <div className="p-3">
          <h3 className="font-semibold text-ink text-sm mb-0.5 line-clamp-2">
            {activity.title}
          </h3>
          <p className="text-muted text-xs mb-2">
            {regionLabel(activity.region)} · {activity.duration}
          </p>
          
          {/* Footer — le prix seul : les avis ne sont plus affichés. */}
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold text-sm">
              Dès {activity.priceFrom}€
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

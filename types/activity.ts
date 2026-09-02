/** Les 5 états de `ActivityStatus` en base, tels quels. */
export type ActivityStatus =
  | 'draft'
  | 'pending_moderation'
  | 'published'
  | 'rejected'
  | 'archived'

export interface ActivitySlot {
  id: string
  date: string
  time: string
  spotsLeft: number
  maxSpots: number
}

export interface ActivityOperator {
  id: string
  name: string
  avatarUrl: string
  verified: boolean
}

export interface Activity {
  id: string
  slug: string
  title: string
  /** Libellé affiché — celui que l'admin peut renommer. */
  category: string
  /** Valeur de filtrage, stable dans l'URL. Ne jamais afficher l'un pour l'autre. */
  categorySlug: string
  region: string
  duration: string
  priceFrom: number
  imageUrl: string
  rating?: number
  lang: string[]
}

export interface ActivityFull extends Activity {
  maxParticipants: number
  languages: string[]
  imageUrls: string[]
  description: Record<'fr' | 'en' | 'de' | 'es' | 'ru', string>
  included: string[]
  excluded: string[]
  operator: ActivityOperator
  slots: ActivitySlot[]
  priceHT: number
  reviewCount: number
}

export interface ActivityFilters {
  region?: string[]
  category?: string[]
  minPrice?: number
  maxPrice?: number
  duration?: string
  lang?: string[]
  page?: number
}

export interface ActivitiesResponse {
  activities: Activity[]
  total: number
  pages: number
}

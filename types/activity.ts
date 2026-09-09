/** Les 5 états de `ActivityStatus` en base, tels quels. */
export type ActivityStatus =
  | 'draft'
  | 'pending_moderation'
  | 'published'
  | 'rejected'
  | 'archived'

/**
 * Comment une activité se vend.
 *
 * `slot` — départs fixes publiés par l'opérateur, prix PAR PERSONNE.
 * `daily` — le touriste choisit sa période, prix FORFAITAIRE du jour.
 *
 * Le front doit aiguiller là-dessus, jamais sur la présence de créneaux : une
 * activité sur créneau dont tous les départs sont passés n'a pas de créneau non
 * plus, et se serait retrouvée à afficher un calendrier de location.
 */
export type BookingMode = 'slot' | 'daily'

export interface ActivitySlot {
  id: string
  date: string
  time: string
  /**
   * Heure de fin, DÉRIVÉE de `date`/`time` + `Activity.durationMinutes`, jamais
   * stockée : la durée appartient à l'activité, pas au départ. La stocker par
   * créneau ferait diverger deux départs de la même activité au premier
   * changement de durée, et il n'existe aucun écran pour les rattraper.
   *
   * `null` quand l'activité n'a pas de durée renseignée — c'est le cas de toute
   * fiche saisie avant le lot B sur laquelle le rétro-remplissage n'a rien pu
   * déduire. L'affichage retombe alors sur la seule heure de départ.
   */
  endTime: string | null
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
  bookingMode: BookingMode
  /**
   * Durée d'une activité sur créneau, en minutes. `null` en mode journée, où
   * c'est le touriste qui choisit la sienne.
   */
  durationMinutes: number | null
  /**
   * Unités louables simultanément, en mode journée. `null` en mode créneau.
   *
   * À NE PAS confondre avec `maxParticipants`, juste en dessous : celui-ci est
   * le nombre de places DANS un véhicule, celui-là le nombre de véhicules.
   */
  dailyUnits: number | null
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

/**
 * Une ligne de la liste déroulante de la barre de recherche.
 *
 * Délibérément plus pauvre qu'`Activity` : la barre n'affiche qu'un titre et sa
 * provenance. Réutiliser `Activity` ici ferait voyager prix, note et image à
 * chaque frappe.
 */
export interface ActivitySuggestion {
  slug: string
  title: string
  /** Libellé affiché, jamais le slug. */
  category: string
  region: string
}

export interface ActivityFilters {
  /** Mot-clé de la barre de recherche. */
  q?: string
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

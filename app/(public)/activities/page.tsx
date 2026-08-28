import type { Metadata } from 'next'
import { activityFiltersSchema } from '@/lib/schemas/activity'
import { listActivities } from '@/server/services/activity'
import type { ActivityFilters } from '@/types/activity'
import { ActivitiesClient } from './ActivitiesClient'

// Composant SERVEUR. La liste est récupérée et rendue côté serveur, donc le
// HTML servi contient les activités — indexable par les moteurs.
//
// Avant, cette page était un composant client dont les données arrivaient via
// useEffect : le HTML ne contenait que des skeletons, et la marketplace ne
// livrait aucun contenu à l'indexation.
//
// Les filtres vivant déjà dans l'URL, chaque combinaison est rendue côté
// serveur et donc indexable elle aussi.

export const metadata: Metadata = {
  title: 'Activities in Mauritius — Trip4mauritius',
  description:
    'Browse and book premium activities in Mauritius: catamaran cruises, hiking, water sports, cultural tours and vehicle rentals, run by verified local operators.',
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const filters = activityFiltersSchema.parse(raw)
  const initialData = await listActivities(filters)

  // Les filtres passés au client suivent le type du front, pas celui de Zod.
  const initialFilters: ActivityFilters = {
    region: filters.region,
    category: filters.category,
    lang: filters.lang,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    duration: filters.duration,
    page: filters.page,
  }

  return <ActivitiesClient initialData={initialData} initialFilters={initialFilters} />
}

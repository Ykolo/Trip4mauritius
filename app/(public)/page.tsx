import { activityFiltersSchema } from '@/lib/schemas/activity'
import { listActivities } from '@/server/services/activity'
import { listPublishedGuides } from '@/server/services/guide'
import { HomeClient } from './HomeClient'

// Composant SERVEUR, comme `/activities` et `/activities/[slug]`.
//
// Cette page était un composant client dont les activités « en vedette »
// étaient un tableau écrit en dur : cinq fiches inventées, avec des images
// Unsplash et des slugs (`le-morne-hiking`, `kitesurf-le-morne`…) qui
// n'existaient dans aucune base. Cliquer dessus menait à un 404, et la page
// d'accueil ne livrait aucun contenu réel à l'indexation.
//
// La sélection vient maintenant du même service que le catalogue : une seule
// source, donc plus d'écart possible entre ce que la home promet et ce que la
// fiche affiche.

/** Ce que la bande horizontale peut montrer sans devenir un second catalogue. */
const FEATURED_COUNT = 6
/** Idem pour les guides : l'accueil renvoie vers /guide, il ne le remplace pas. */
const GUIDES_COUNT = 4

export default async function HomePage() {
  // `listActivities` ne renvoie que les activités publiées et trie par note
  // décroissante : les six premières font une sélection acceptable sans
  // introduire de notion de « mise en avant » en base.
  const [{ activities }, guides] = await Promise.all([
    listActivities(activityFiltersSchema.parse({})),
    listPublishedGuides(),
  ])

  return (
    <HomeClient
      featured={activities.slice(0, FEATURED_COUNT)}
      guides={guides.slice(0, GUIDES_COUNT)}
    />
  )
}

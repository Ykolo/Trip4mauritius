import Link from 'next/link'
import { CalendarX, Search } from 'lucide-react'

// 404 propre à une fiche d'activité.
//
// `app/(public)/activities/[slug]/page.tsx` appelle `notFound()` dès qu'un slug
// ne correspond à aucune activité PUBLIÉE — ce qui arrive aussi quand une
// activité est archivée ou dépubliée par la modération. Le 404 global parlerait
// d'« adresse mal recopiée », ce qui serait faux : le lien était bon hier.
//
// Étant dans le groupe `(public)`, cet écran hérite de la TopBar et du Footer :
// l'utilisateur garde sa navigation.

export default function ActivityNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <CalendarX className="w-10 h-10 text-primary" />
        </div>

        <h1 className="font-body font-bold text-2xl text-ink mb-3">
          Cette activité n&apos;est plus proposée
        </h1>
        <p className="text-muted mb-8">
          Elle a peut-être été retirée par son opérateur, ou n&apos;est plus au
          catalogue. D&apos;autres expériences vous attendent dans la même
          région.
        </p>

        <Link
          href="/activities"
          className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-transform"
        >
          <Search className="w-5 h-5" />
          Voir toutes les activités
        </Link>
      </div>
    </div>
  )
}

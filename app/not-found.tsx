import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, Home, Search } from 'lucide-react'

// 404 global.
//
// Rendu par `app/layout.tsx` seul — il est HORS du groupe `(public)`, donc sans
// TopBar ni Footer. D'où les liens de sortie explicites ci-dessous : sans eux,
// l'écran serait un cul-de-sac.

export const metadata: Metadata = {
  title: 'Page introuvable — Trip4mauritius',
  // La réponse porte déjà un statut 404, mais l'indiquer évite qu'une page
  // d'erreur atterrisse dans l'index si elle est servie via un lien partagé.
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="inline-block mb-10">
          <span className="font-display text-primary text-3xl">
            Trip4mauritius
          </span>
        </Link>

        <div className="relative mb-8">
          <p className="font-display text-primary/15 text-[7rem] leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Compass className="w-10 h-10 text-primary" />
            </div>
          </div>
        </div>

        <h1 className="font-body font-bold text-2xl text-ink mb-3">
          Cette page a disparu du lagon
        </h1>
        <p className="text-muted mb-8">
          Le lien est peut-être périmé, ou l&apos;adresse mal recopiée. Il reste
          beaucoup à découvrir sur l&apos;île.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/activities"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-transform"
          >
            <Search className="w-5 h-5" />
            Parcourir les activités
          </Link>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white shadow-card text-ink font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-transform"
          >
            <Home className="w-5 h-5" />
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

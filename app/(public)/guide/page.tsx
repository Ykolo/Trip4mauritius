import type { Metadata } from 'next'
import Link from 'next/link'

import {
  listActiveGuideCategories,
  listPublishedGuides,
} from '@/server/services/guide'

// Composant SERVEUR : c'est une page éditoriale, son intérêt est d'être
// indexable. Les régions et catégories renvoient vers le catalogue filtré,
// avec les mêmes paramètres d'URL que `/activities` — un lien qui ne
// correspondrait à aucun filtre réel donnerait une page vide.

export const metadata: Metadata = {
  title: 'Guide de l’île Maurice — Trip4mauritius',
  description:
    "Quand partir, quelle région choisir, combien prévoir : le guide pratique pour préparer son séjour à l'île Maurice et réserver ses activités.",
}

const REGIONS = [
  {
    name: 'North',
    label: 'Nord',
    text: "La côte la plus animée : Grand Baie, ses restaurants et ses départs en mer. C'est là qu'on trouve le plus de croisières et de sports nautiques, et la vie continue après le coucher du soleil.",
  },
  {
    name: 'West',
    label: 'Ouest',
    text: "Le Morne, Tamarin, les dauphins au petit matin. Couchers de soleil et lagons calmes, avec les plus belles randonnées de l'île à portée de voiture.",
  },
  {
    name: 'South',
    label: 'Sud',
    text: "La côte sauvage, moins fréquentée : falaises de Gris Gris, terres colorées de Chamarel, forêts des gorges. À privilégier pour la nature et les paysages.",
  },
  {
    name: 'East',
    label: 'Est',
    text: "Les lagons turquoise et l'Île aux Cerfs. Plus venteux, donc apprécié des kitesurfeurs, et plus tranquille que le Nord.",
  },
  {
    name: 'Centre',
    label: 'Centre',
    text: "Les hauts plateaux, plus frais de quelques degrés. Curepipe, les lacs sacrés, les points de vue — l'intérieur qu'on oublie souvent en restant sur la côte.",
  },
]

const SEASONS = [
  {
    period: 'Mai à novembre',
    title: 'Hiver austral',
    text: "Saison sèche, 20 à 25 °C, peu de pluie. La meilleure période pour la randonnée et les excursions à la journée. C'est aussi la haute saison : réservez tôt.",
  },
  {
    period: 'Décembre à avril',
    title: 'Été austral',
    text: "Chaud et humide, 25 à 33 °C, averses courtes mais intenses. L'eau est à sa température la plus agréable. Risque cyclonique de janvier à mars — surveillez les alertes.",
  },
]

const PRACTICAL = [
  ['Décalage horaire', "UTC+4 toute l'année. L'île n'observe aucun changement d'heure : les horaires affichés sur le site sont ceux de Maurice."],
  ['Langues', "Le créole mauricien au quotidien, le français très largement compris, l'anglais pour l'administration."],
  ['Monnaie', "La roupie mauricienne (MUR). Les prix du site sont affichés en euros."],
  ['Se déplacer', "Louer un véhicule reste le moyen le plus simple de circuler. On roule à gauche."],
  ['Santé', "Aucun vaccin obligatoire. Prévoyez une protection solaire élevée : l'ensoleillement est fort toute l'année."],
]

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>
}) {
  // Le filtre voyage par SLUG dans l'URL — c'est lui qui est partagé et
  // indexé. Le libellé, lui, n'est qu'affiché.
  const { categorie } = await searchParams

  const [categories, guides] = await Promise.all([
    listActiveGuideCategories(),
    listPublishedGuides(categorie),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      <header>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
          Guide de l&rsquo;île Maurice
        </h1>
        <p className="text-muted">
          Ce qu&rsquo;il faut savoir avant de réserver : quand venir, où loger, et à quoi
          s&rsquo;attendre région par région.
        </p>
      </header>

      <section>
        <h2 className="text-2xl font-semibold text-ink mb-4">Quand partir</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {SEASONS.map((s) => (
            <div key={s.period} className="rounded-2xl bg-white shadow-card p-5">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                {s.period}
              </span>
              <h3 className="font-semibold text-ink mt-1 mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink mb-4">Choisir sa région</h2>
        <div className="space-y-3">
          {REGIONS.map((r) => (
            <Link
              key={r.name}
              href={`/activities?region=${r.name}`}
              className="block rounded-2xl bg-white shadow-card p-5 transition-transform hover:scale-[1.01]"
            >
              <h3 className="font-semibold text-ink mb-1">{r.label}</h3>
              <p className="text-sm text-muted leading-relaxed mb-2">{r.text}</p>
              <span className="text-sm text-primary font-medium">
                Voir les activités du {r.label} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink mb-4">Nos articles</h2>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <Link
              href="/guide"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categorie
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-primary text-white'
              }`}
            >
              Tout
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/guide?categorie=${c.slug}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  categorie === c.slug
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}

        {guides.length === 0 ? (
          <p className="text-muted text-sm">
            {categorie
              ? 'Aucun article dans cette catégorie pour le moment.'
              : 'Aucun article publié pour le moment.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className="rounded-2xl bg-white shadow-card overflow-hidden group"
              >
                {guide.imageUrl && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {/* `img` et non `next/image` : l'URL est saisie par l'admin,
                        donc de domaine imprévisible, et `images.unoptimized`
                        est déjà posé pour le reste du site. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={guide.imageUrl}
                      alt=""
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">
                    {guide.category}
                  </span>
                  <h3 className="font-semibold text-ink mt-1 mb-2">
                    {guide.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed line-clamp-3">
                    {guide.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink mb-4">Informations pratiques</h2>
        <dl className="rounded-2xl bg-white shadow-card divide-y divide-muted/15">
          {PRACTICAL.map(([term, def]) => (
            <div key={term} className="p-5">
              <dt className="font-semibold text-ink text-sm mb-1">{term}</dt>
              <dd className="text-sm text-muted leading-relaxed">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl bg-primary/5 p-6 text-center">
        <h2 className="text-xl font-semibold text-ink mb-2">Prêt à réserver ?</h2>
        <p className="text-sm text-muted mb-4">
          Toutes nos activités sont opérées par des prestataires locaux vérifiés.
        </p>
        <Link
          href="/activities"
          className="inline-block px-6 py-3 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          Parcourir le catalogue
        </Link>
      </section>
    </div>
  )
}

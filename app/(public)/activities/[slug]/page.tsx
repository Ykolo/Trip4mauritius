import { ArrowLeft, CheckCircle2, Clock, MapPin, ShieldCheck, Star, Ticket } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PriceBreakdownWrapper as BookingPanel } from '@/components/ui/PriceBreakdownWrapper'
import { getActivityBySlug } from '@/server/services/activity'

// Composant SERVEUR alimenté par la base.
//
// Cette page fabriquait auparavant son contenu à partir du slug de l'URL —
// titre reconstruit par remplacement de tirets, images Unsplash génériques,
// note et prix codés en dur. Elle affiche désormais l'activité réelle.

const FALLBACK_IMAGE = '/images/hero.jpg'

// Pas de generateStaticParams : rendu serveur à la demande, conformément au
// choix « hybride sans génération statique ». Le contenu reste indexable, sans
// introduire de péremption quand un opérateur modifie son activité.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const activity = await getActivityBySlug(slug)

  if (!activity) return { title: 'Activité introuvable — Trip4mauritius' }

  const description = activity.description.fr

  return {
    title: `${activity.title} — Trip4mauritius`,
    description,
    openGraph: {
      title: activity.title,
      description,
      images: activity.imageUrls.length > 0 ? activity.imageUrls : [FALLBACK_IMAGE],
      type: 'website',
    },
  }
}

export default async function ActivityDetailedPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const activity = await getActivityBySlug(slug)

  if (!activity) notFound()

  const images = activity.imageUrls.length > 0 ? activity.imageUrls : [FALLBACK_IMAGE]

  return (
    <div className="pb-8">
      <div className="relative w-full h-[50vh] min-h-[400px] overflow-hidden">
        <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {images.map((img, i) => (
            <div key={img} className="relative w-full flex-shrink-0 snap-center h-full">
              <Image
                src={img}
                alt={`Vue ${i + 1} de l'activité ${activity.title}`}
                fill
                priority={i === 0}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            </div>
          ))}
        </div>

        <header className="absolute top-4 left-0 right-0 flex items-center px-4 max-w-7xl mx-auto z-10 pointer-events-none">
          <Link
            href="/activities"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition shadow border border-white/10 pointer-events-auto active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </header>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 max-w-7xl mx-auto pointer-events-none">
          <div className="flex flex-wrap items-center gap-3 mb-4 pointer-events-auto">
            <span className="bg-primary text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-widest shadow-lg">
              {activity.category}
            </span>
            {activity.rating !== undefined && (
              <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 shadow-sm">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">
                  {activity.rating} ({activity.reviewCount} avis)
                </span>
              </div>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display text-white drop-shadow-md mb-3">
            {activity.title}
          </h1>
          <p className="text-white/90 font-body flex items-center gap-1.5 drop-shadow-sm font-medium text-sm md:text-base">
            <MapPin className="w-5 h-5 text-accent" /> Île Maurice — {activity.region}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-12 relative">
        <div className="flex-1 space-y-10">
          <div className="flex flex-wrap gap-x-8 gap-y-4 border-b border-muted/20 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] text-muted font-bold uppercase tracking-widest">Durée</p>
                <p className="font-bold text-ink text-lg">{activity.duration}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] text-muted font-bold uppercase tracking-widest">Capacité</p>
                <p className="font-bold text-ink text-lg">
                  {activity.maxParticipants} personnes max.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] text-muted font-bold uppercase tracking-widest">
                  Opérateur
                </p>
                <p className="font-bold text-ink text-lg">
                  {activity.operator.name}
                  {activity.operator.verified && ' ✓'}
                </p>
              </div>
            </div>
          </div>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold font-body text-ink mb-4">
              À propos de cette expérience
            </h2>
            <p className="text-muted leading-relaxed font-body text-lg">
              {activity.description.fr}
            </p>
          </section>

          {activity.included.length > 0 && (
            <section className="bg-base rounded-3xl p-6 md:p-8 border border-muted/10">
              <h2 className="text-xl font-bold font-body text-ink mb-6">Ce qui est inclus</h2>
              <ul className="grid sm:grid-cols-2 gap-4">
                {activity.included.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-ink font-body font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activity.excluded.length > 0 && (
            <section>
              <h2 className="text-xl font-bold font-body text-ink mb-4">Non inclus</h2>
              <ul className="space-y-2">
                {activity.excluded.map((item) => (
                  <li key={item} className="text-muted font-body">
                    • {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:w-[420px]">
          <div className="sticky top-24">
            <div className="border border-muted/20 bg-surface rounded-[2rem] shadow-card overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-b border-muted/10">
                <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">
                  Dès {activity.priceHT}€ / Pers.
                </p>
                <h3 className="text-2xl font-display text-ink">Votre sélection</h3>
              </div>
              <BookingPanel activity={activity} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

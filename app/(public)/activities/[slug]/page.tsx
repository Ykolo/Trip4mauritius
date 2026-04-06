import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock, MapPin, Star, ShieldCheck, CheckCircle2, Ticket } from "lucide-react";
import { PriceBreakdownWrapper as PriceBreakdown } from "@/components/ui/PriceBreakdownWrapper";

export default async function ActivityDetailedPage({ params }: { params: Promise<{ slug: string }> }) {
  // Await the params promise (Next.js 15+ requirement)
  const resolvedParams = await params;
  
  // Format slug to readable title
  const title = resolvedParams.slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  // Photos of the activity
  const images = [
    "https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=1600&q=80",
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80",
    "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&q=80",
    "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=1600&q=80",
    "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=1600&q=80"
  ];
  
  return (
    <div className="pb-8">
      {/* Hero Header Carousel */}
      <div className="relative w-full h-[50vh] min-h-[400px] overflow-hidden">
        
        {/* Horizontal Snapping Scroll Container */}
        <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {images.map((img, i) => (
            <div key={i} className="relative w-full flex-shrink-0 snap-center h-full">
              <Image
                src={img}
                alt={`Vue ${i + 1} de l'activité ${title}`}
                fill
                priority={i === 0}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            </div>
          ))}
        </div>
        
        {/* Top Navbar overlay - Modifié pour s'intégrer sous la TopBar globale */}
        <header className="absolute top-4 left-0 right-0 flex items-center px-4 max-w-7xl mx-auto z-10 pointer-events-none">
          <Link href="/" className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition shadow border border-white/10 pointer-events-auto active:scale-95">
             <ArrowLeft className="w-5 h-5" />
          </Link>
        </header>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 max-w-7xl mx-auto pointer-events-none">
          <div className="flex flex-wrap items-center gap-3 mb-4 pointer-events-auto">
            <span className="bg-primary text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-widest shadow-lg">Choix VIP</span>
            <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 shadow-sm">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-semibold">4.9 (128 avis vérifiés)</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display text-white drop-shadow-md mb-3">{title || "Aventure Inoubliable"}</h1>
          <p className="text-white/90 font-body flex items-center gap-1.5 drop-shadow-sm font-medium text-sm md:text-base">
            <MapPin className="w-5 h-5 text-accent" /> Île Maurice (Sud-Ouest)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-12 relative">
        <div className="flex-1 space-y-10">
          
          {/* Quick Info Bar */}
          <div className="flex flex-wrap gap-x-8 gap-y-4 border-b border-muted/20 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm"><Clock className="w-6 h-6" /></div>
              <div><p className="text-[11px] text-muted font-bold uppercase tracking-widest">Durée</p><p className="font-bold text-ink text-lg">Demi-journée</p></div>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm"><Ticket className="w-6 h-6" /></div>
               <div><p className="text-[11px] text-muted font-bold uppercase tracking-widest">Type</p><p className="font-bold text-ink text-lg">Billet Mobile</p></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shadow-sm"><ShieldCheck className="w-6 h-6" /></div>
              <div><p className="text-[11px] text-muted font-bold uppercase tracking-widest">Annulation</p><p className="font-bold text-ink text-lg">Gratuite (48h avant)</p></div>
            </div>
          </div>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold font-body text-ink mb-4">À propos de cette expérience</h2>
            <p className="text-muted leading-relaxed font-body text-lg">
              Vivez une expérience unique et authentique au cœur de l'Île Maurice. Loin des foules touristiques, nos guides locaux certifiés vous emmènent découvrir les secrets les mieux gardés du lagon et des montagnes environnantes. 
            </p>
            <p className="text-muted leading-relaxed font-body text-lg mt-4">
              Préparez-vous à en prendre plein les yeux avec des panoramas à 360° et une immersion totale dans la riche culture créole. Que ce soit sur terre, en l'air ou sur l'eau, chaque instant est pensé pour vous offrir un souvenir mémorable.
            </p>
          </section>

          <section className="bg-base rounded-3xl p-6 md:p-8 border border-muted/10">
            <h2 className="text-xl font-bold font-body text-ink mb-6">Ce qui est inclus</h2>
            <ul className="grid sm:grid-cols-2 gap-4">
              {['Guide local certifié', 'Équipement complet de sécurité', 'Déjeuner traditionnel Mauricien', 'Navette depuis votre hôtel', 'Taxes environnementales', 'Photos souvenirs offertes'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                     <CheckCircle2 className="w-4 h-4 text-green-600" />
                   </div>
                   <span className="text-ink font-body font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </section>

        </div>

        {/* Sidebar Widget (PriceBreakdown Validation) - Sticky on Desktop */}
        <aside className="lg:w-[420px]">
          <div className="sticky top-24">
             {/* Component Audited Earlier - We reuse it to show payment logic integration */}
             <div className="border border-muted/20 bg-surface rounded-[2rem] shadow-card overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-b border-muted/10">
                  <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">Dès 65€ / Pers.</p>
                  <h3 className="text-2xl font-display text-ink">Votre sélection</h3>
                </div>
                <div className="p-2">
                  <PriceBreakdown 
                      priceHT={65} 
                      maxParticipants={10}
                      selectedSlotId="slot-1"
                      activityId={resolvedParams.slug}
                  />
                </div>
             </div>
          </div>
        </aside>
      </div>

    </div>
  );
}

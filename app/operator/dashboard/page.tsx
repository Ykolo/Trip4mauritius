import { ArrowUpRight, Ticket, Users, Wallet } from "lucide-react";

export default function OperatorDashboardPage() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-primary md:hidden mb-1 flex items-center justify-between">
          Trip4mauritius<span className="text-ink font-body text-xs font-bold uppercase tracking-wider bg-white shadow-sm border border-muted/10 px-2 py-1 rounded-md">Pro</span>
        </h1>
        <h2 className="font-body font-bold text-2xl text-ink mt-6 md:mt-0">Bonjour, Ocean Adventures 👋</h2>
        <p className="text-muted mt-1">Voici le résumé de votre activité pour aujourd'hui sur l'Île Maurice.</p>
      </header>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { title: "Gains du jour", value: "€1,240", icon: Wallet, trend: "+12%" },
          { title: "Réservations", value: "8", icon: Ticket, trend: "+3" },
          { title: "Embarquements", value: "24", icon: Users, trend: "+5" },
          { title: "Score Qualité", value: "4.9/5", icon: ArrowUpRight, trend: "Top 5%" }
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-card border border-muted/10 flex flex-col justify-between hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-4">
              <span className="text-muted text-sm font-semibold">{kpi.title}</span>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <kpi.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-body font-bold text-3xl text-ink">{kpi.value}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Widget Zone */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-muted/10 p-6 min-h-[400px]">
          <h3 className="font-body font-bold text-lg text-ink mb-4">Évolution des Réservations</h3>
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted/20 rounded-xl">
             <p className="text-muted font-body text-sm font-medium">Zone d'intégration du graphique Recharts</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-6 min-h-[400px]">
           <h3 className="font-body font-bold text-lg text-ink mb-4">Prochains Départ (Aujourd'hui)</h3>
           <div className="space-y-4">
             {[
               { time: "10:30", activity: "Catamaran au Nord", pax: 12 },
               { time: "14:00", activity: "Formule Sunset", pax: 8 },
             ].map((slot, i) => (
               <div key={i} className="p-4 bg-base rounded-xl border border-muted/10">
                 <p className="text-primary font-bold text-sm mb-1">{slot.time}</p>
                 <p className="font-body font-semibold text-ink text-sm">{slot.activity}</p>
                 <p className="text-muted text-xs mt-1">{slot.pax} Participants attendus</p>
               </div>
             ))}
           </div>
        </div>
      </div>
      
    </div>
  );
}

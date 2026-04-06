"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Ticket, Wallet, Settings } from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/planning", label: "Administration", icon: CalendarDays },
  { href: "/bookings", label: "Réservations", icon: Ticket },
  { href: "/wallet", label: "Revenus", icon: Wallet },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function OperatorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-surface border-r border-muted/20 sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-muted/20 shrink-0">
        <span className="font-display text-2xl text-primary">Trip4mauritius<span className="text-ink font-body text-xs font-bold uppercase tracking-wider ml-2 bg-base px-2 py-1 rounded-md">Pro</span></span>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {menuItems.map((item) => {
          // Adjust active state matching for proper route grouping logic
          const actualHref = `/operator${item.href}`;
          const isActive = pathname.startsWith(actualHref);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={actualHref}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted hover:bg-base hover:text-ink font-medium"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-body text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* Operator Profile Preview */}
      <div className="p-4 border-t border-muted/20 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold border border-accent/20">
            OA
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-ink line-clamp-1">Ocean Adventures</p>
            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 block"></span> En ligne
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

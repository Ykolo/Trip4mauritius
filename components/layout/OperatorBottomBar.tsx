"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Ticket, Settings } from "lucide-react";

const mobileItems = [
  { href: "/operator/dashboard", label: "Général", icon: LayoutDashboard },
  { href: "/operator/planning", label: "Admin", icon: CalendarDays },
  { href: "/operator/bookings", label: "Résas", icon: Ticket },
  { href: "/operator/settings", label: "Réglages", icon: Settings },
];

export function OperatorBottomBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-surface border-t border-muted/20 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-full">
        {mobileItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
             <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full active:scale-95 transition-transform ${
                isActive ? "text-primary" : "text-muted"
              }`}
            >
              <Icon className={`w-[22px] h-[22px] ${isActive ? "drop-shadow-sm" : ""}`} />
              <span className={`text-[10px] font-body mt-1 ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

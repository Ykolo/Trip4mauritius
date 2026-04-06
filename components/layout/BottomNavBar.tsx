"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Calendar, User } from "lucide-react";

const navItems = [
  { href: "/", label: "Explorer", icon: Home },
  { href: "/activities", label: "Activités", icon: Target },
  { href: "/bookings", label: "Réservations", icon: Calendar },
  { href: "/account", label: "Compte", icon: User },
];

export function BottomNavBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-muted/20 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-full max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-3 active:scale-95 transition-transform ${active ? "text-primary" : "text-muted"
                }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-body font-medium mt-1">{item.label}</span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

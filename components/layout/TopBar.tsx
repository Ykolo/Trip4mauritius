"use client";

import { useState } from "react";
import { Search, ShoppingCart, X } from "lucide-react";
import Image from "next/image";

interface TopBarProps {
  cartCount?: number;
}

export function TopBar({ cartCount = 0 }: TopBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-muted/10">
      <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-7xl mx-auto">
        <div className={`flex-shrink-0 h-full py-1 ${isSearchOpen ? "hidden md:block" : ""}`}>
          <Image src="/images/logo.jpg" alt="Trip4mauritius" width={180} height={48} className="h-full w-auto object-contain" />
        </div>

        {/* Center: Search */}
        <div
          className={`flex-1 mx-4 ${isSearchOpen ? "flex" : "hidden md:flex"
            } items-center justify-center`}
        >
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60" />
            <input
              type="text"
              placeholder="Rechercher une activité…"
              className="w-full h-10 pl-10 pr-4 rounded-2xl border border-primary/20 bg-primary/5 text-ink placeholder:text-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/50 font-body text-sm"
            />
            {isSearchOpen && (
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[48px] min-h-[48px] flex items-center justify-center md:hidden active:scale-95 transition-transform"
                aria-label="Fermer la recherche"
              >
                <X className="w-5 h-5 text-primary/70" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className={`flex items-center gap-1 ${isSearchOpen ? "hidden md:flex" : ""}`}>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center md:hidden active:scale-95 transition-transform"
            aria-label="Ouvrir la recherche"
          >
            <Search className="w-5 h-5 text-primary" />
          </button>

          <button
            className="relative min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
            aria-label={`Panier avec ${cartCount} articles`}
          >
            <ShoppingCart className="w-5 h-5 text-primary" />
            {cartCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-white text-xs font-body font-bold rounded-full px-1">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

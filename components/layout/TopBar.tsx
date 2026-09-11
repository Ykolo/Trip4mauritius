"use client";

import { useState } from "react";
import { Search, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SearchBox } from "@/components/layout/SearchBox";
import { useCartHydrated, useCartStore } from "@/lib/stores/cart";

// AUCUN raccourci vers le back-office ici.
//
// La barre du haut est rendue sur toutes les pages publiques, donc pour tous
// les visiteurs : y placer un lien « Admin », même conditionné au rôle, faisait
// exister l'administration dans l'interface du touriste. Le client a tranché —
// l'admin tape `/admin` lui-même.
//
// Ce retrait n'enlève RIEN à la sécurité et n'en ajoute rien non plus : le lien
// n'était que de l'affichage, `/admin` restant gardé par `AdminGuard` côté
// écran et par `adminProcedure` côté serveur. Ce sont toujours les deux seuls
// contrôles réels.
//
// AUCUN raccourci vers `/account` non plus, pour la même raison et sur la même
// décision du client : le touriste ne doit pas voir d'icône de profil. La page
// existe toujours et reste protégée par `proxy.ts` puis par les procédures ;
// elle n'a simplement plus de point d'entrée dans l'interface publique.
//
// ⚠️ Conséquence à connaître : `/account` porte AUSSI le formulaire de
// connexion (`AuthForm`). Plus rien n'y mène désormais depuis le site public —
// on n'y arrive que par la redirection de `proxy.ts` (visite d'une page
// protégée) ou en tapant l'adresse. Le jour où une entrée « Se connecter » est
// souhaitée, c'est un écran à part qu'il faudra, pas cette icône.

export function TopBar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Le compteur était figé à 0 et l'icône ne menait nulle part : le panier se
  // remplissait sans aucun retour visible. Il est lu ici directement dans le
  // store plutôt que passé en prop — le layout qui rend TopBar est un composant
  // serveur, il ne peut pas connaître un état qui vit dans localStorage.
  const itemCount = useCartStore((s) => s.items.length);
  const hydrated = useCartHydrated();
  // Avant réhydratation, le serveur a rendu 0 : afficher le compte restauré
  // trop tôt provoquerait une erreur d'hydratation.
  const cartCount = hydrated ? itemCount : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-muted/10">
      <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-7xl mx-auto">
        <Link
          href="/"
          aria-label="Trip4mauritius — retour à l'accueil"
          className={`flex-shrink-0 h-full py-1 active:scale-95 transition-transform ${isSearchOpen ? "hidden md:block" : ""}`}
        >
          <Image src="/images/logo.jpg" alt="Trip4mauritius" width={180} height={48} className="h-full w-auto object-contain" />
        </Link>

        {/* Center: Search */}
        <div
          className={`flex-1 mx-4 ${isSearchOpen ? "flex" : "hidden md:flex"
            } items-center justify-center`}
        >
          {/* Champ, suggestions et soumission vivent dans `SearchBox`. La barre
              du haut n'en garde que le placement et, sur mobile, l'ouverture. */}
          <SearchBox onDone={() => setIsSearchOpen(false)} />

          {isSearchOpen && (
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center md:hidden active:scale-95 transition-transform"
              aria-label="Fermer la recherche"
            >
              <X className="w-5 h-5 text-primary/70" />
            </button>
          )}
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

          <Link
            href="/cart"
            className="relative min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
            aria-label={`Panier avec ${cartCount} activité(s)`}
          >
            <ShoppingCart className="w-5 h-5 text-primary" />
            {cartCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-white text-xs font-body font-bold rounded-full px-1">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, BookOpen, MessageCircle } from "lucide-react";

import { useFeature } from "@/components/providers/FeatureProvider";
import { whatsappHref } from "@/lib/whatsapp";

const navItems = [
  { href: "/", label: "Explorer", icon: Home },
  { href: "/activities", label: "Activités", icon: Target },
  { href: "/guide", label: "Guides", icon: BookOpen },
];

export function BottomNavBar() {
  const pathname = usePathname();
  // Même frontière que le pied de page : un seul flag commande tous les points
  // d'entrée WhatsApp. Désactivé, la barre retombe à trois onglets.
  const showWhatsapp = useFeature("whatsapp.contact");

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

        {/* Sortie hors du site : c'est un <a>, pas un <Link>. `noreferrer`
            évite de divulguer la page d'origine à WhatsApp.

            Le libellé dit « Contact » et non « WhatsApp » : le visiteur n'a
            pas à connaître le canal pour cliquer, et le nommer restreignait
            l'invitation à ceux qui l'utilisent déjà. La destination, elle, ne
            change pas — le client veut être joint là.

            SEUL élément plein de la barre, en pastille pleine largeur de
            texte : le contact est la conversion attendue de ce site, il ne
            peut pas se présenter comme un quatrième onglet parmi les autres.
            `aria-label` conserve la mention WhatsApp — annoncer la sortie vers
            une application tierce est utile à qui ne voit pas l'icône. */}
        {showWhatsapp && (
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Nous contacter sur WhatsApp"
            className="flex items-center gap-2 h-11 min-w-[48px] px-4 rounded-full bg-primary text-white shadow-card ring-4 ring-primary/10 active:scale-95 transition-transform"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-body font-semibold">Contact</span>
          </a>
        )}
      </div>
    </nav>
  );
}

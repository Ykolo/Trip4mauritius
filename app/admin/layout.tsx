'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  LayoutDashboard,
  MapPin,
  Store,
  Tags,
  Ticket,
  ToggleLeft,
} from 'lucide-react'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { useSession } from '@/lib/auth-client'

// Navigation par barre du bas, comme le reste du site.
//
// C'était une barre haute collante. Le parcours d'administration se fait au
// pouce sur mobile, comme l'espace public et l'espace opérateur : trois
// grammaires de navigation dans une même application obligeaient l'utilisateur
// à réapprendre à chaque changement d'espace.
//
// L'onglet « Modération » a disparu au lot 1 — Trip4mauritius tient son
// catalogue, il n'y a plus de file d'attente. « Comptes » aussi : il n'existe
// pas de gestion de compte.

const TABS = [
  { href: '/admin', label: 'Résumé', icon: LayoutDashboard },
  { href: '/admin/activities', label: 'Catalogue', icon: MapPin },
  { href: '/admin/bookings', label: 'Résas', icon: Ticket },
  { href: '/admin/operators', label: 'Opérateurs', icon: Store },
  { href: '/admin/guides', label: 'Guides', icon: BookOpen },
  { href: '/admin/categories', label: 'Catégories', icon: Tags },
]

/** Réservé au super admin (Kled). Voir `superAdminProcedure`. */
const SUPER_ADMIN_TAB = {
  href: '/admin/features',
  label: 'Réglages',
  icon: ToggleLeft,
}

function AdminNav() {
  const pathname = usePathname()

  // Le rôle vient de la SESSION, pas de `operator.myProfile` : cette procédure
  // renvoie `null` pour tout compte sans profil opérateur — donc pour l'admin
  // comme pour le super admin, et l'onglet n'apparaîtrait jamais.
  //
  // Masquer l'onglet n'est que du confort de toute façon :
  // `superAdminProcedure` refuse un `admin` qui appellerait la procédure
  // directement.
  const { data: session } = useSession()
  const tabs =
    session?.user?.role === 'superadmin' ? [...TABS, SUPER_ADMIN_TAB] : TABS

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-muted/20 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const active =
            tab.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] px-1 py-2 active:scale-95 transition-transform ${
                active ? 'text-primary' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[11px] font-medium leading-none text-center">
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminGuard>
        {/* La marge basse réserve la hauteur de la barre : sans elle, le
            dernier élément de chaque écran passe dessous et devient
            inatteignable. */}
        <main className="pb-24">{children}</main>
        <AdminNav />
      </AdminGuard>
    </div>
  )
}

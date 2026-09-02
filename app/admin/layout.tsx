'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  ShieldCheck,
  Store,
  Tags,
  ToggleLeft,
} from 'lucide-react'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { useTRPC } from '@/lib/trpc/client'

const TABS = [
  { href: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/admin/moderation', label: 'Modération', icon: ShieldCheck },
  { href: '/admin/operators', label: 'Opérateurs', icon: Store },
  { href: '/admin/categories', label: 'Catégories', icon: Tags },
  { href: '/admin/features', label: 'Fonctionnalités', icon: ToggleLeft },
]

/** Pastille de file d'attente — un chiffre visible évite qu'une demande
 *  attende parce que personne n'a pensé à ouvrir l'onglet. */
function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function AdminNav() {
  const pathname = usePathname()
  const trpc = useTRPC()
  const { data: overview } = useQuery(trpc.admin.overview.queryOptions())

  const counts: Record<string, number> = {
    '/admin/moderation': overview?.pendingActivities ?? 0,
    '/admin/operators': overview?.pendingOperators ?? 0,
  }

  return (
    <nav className="bg-white border-b border-muted/10 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
        <span className="font-display text-primary text-lg pr-4 whitespace-nowrap">
          Administration
        </span>
        {TABS.map((tab) => {
          const active =
            tab.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <Badge count={counts[tab.href] ?? 0} />
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
        <AdminNav />
        <main>{children}</main>
      </AdminGuard>
    </div>
  )
}

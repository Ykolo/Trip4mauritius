'use client'

import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { cartItemKey, useCartHydrated, useCartTotals } from '@/lib/stores/cart'
import { CartItemRow } from '@/components/ui/CartItemRow'
import { CartSummary } from '@/components/ui/CartSummary'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

export default function CartPage() {
  const cart = useCartTotals()
  const hydrated = useCartHydrated()

  // Le serveur rend forcément un panier vide : afficher immédiatement le
  // contenu restauré depuis localStorage provoquerait une erreur d'hydratation.
  // On attend donc explicitement la relecture.
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-base">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-semibold text-ink mb-6">Mon panier</h1>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="hidden lg:block">
              <div className="rounded-2xl bg-white shadow-card p-6 h-64 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-8xl mb-6">🏖️</div>
          <h1 className="text-2xl font-semibold text-ink mb-2">
            Votre panier est vide
          </h1>
          <p className="text-muted mb-6">
            Découvrez les activités à faire à l&apos;île Maurice
          </p>
          <Link
            href="/activities"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-transform"
          >
            <ShoppingBag className="w-5 h-5" />
            Parcourir les activités
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink mb-6">
          Mon panier ({cart.itemCount})
        </h1>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* `min-w-0` n'est pas décoratif : sans lui, cette colonne garde le
              `min-width: auto` par défaut des éléments de grille et refuse de
              descendre sous la largeur MINIMALE de son contenu. Or le titre
              d'activité porte `truncate`, donc `white-space: nowrap`, donc une
              largeur minimale égale au titre entier — 679 px mesurés pour un
              écran de 375. La piste s'étirait à 679 px et c'est la page entière
              qui partait en défilement latéral, en-tête et récapitulatif
              compris. Avec `min-w-0`, la colonne se plie et `truncate` fait
              enfin ce que son nom promet. */}
          <div className="space-y-4 min-w-0">
            {cart.items.map((item) => (
              // `cartItemKey` est la clé de ligne : le créneau en mode créneau,
              // l'activité ET la période en mode journée. Le `slotId` seul ne
              // pouvait plus servir — une location n'en a pas.
              <CartItemRow key={cartItemKey(item)} item={item} />
            ))}
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <CartSummary
              itemCount={cart.itemCount}
              totalDeposit={cart.totalDeposit}
              totalOnSite={cart.totalOnSite}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

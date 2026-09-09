'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { cartItemKey, cartItemUnits } from '@/lib/cart-lines'
import { computeBookingAmounts } from '@/lib/pricing'
import type { CartItem, CartTotals } from '@/types/cart'

// Ré-exportés pour que les écrans n'aient qu'un import à faire : la clé de
// ligne et le store vont toujours ensemble. La définition, elle, vit dans
// `lib/cart-lines.ts` — pure, et donc testable sans `localStorage`.
export { cartItemKey, cartItemUnits }

// Le panier vit dans le NAVIGATEUR, pas en base.
//
// Un panier n'engage rien : aucune place n'est retenue tant que la réservation
// n'est pas créée. Le persister en base coûterait une table, un router, une
// logique de fusion à la connexion et un nettoyage des paniers abandonnés —
// pour un tunnel où l'on réserve en une seule session. Contrepartie assumée :
// le panier ne suit pas l'utilisateur d'un appareil à l'autre.
//
// Conséquence à ne jamais perdre de vue : tout ce qui est ici est MODIFIABLE
// par l'utilisateur. Les montants affichés sont indicatifs ; ceux qui comptent
// sont recalculés par server/services/booking.ts à partir du prix en base.

interface CartState {
  items: CartItem[]
  /** Remplace la ligne si la même clé est déjà au panier. */
  add: (item: CartItem) => void
  remove: (key: string) => void
  setParticipants: (key: string, participants: number) => void
  clear: () => void
  hasHydrated: boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,

      add: (item) =>
        set((state) => {
          // Ré-ajouter la même ligne l'ajuste au lieu d'en créer une seconde,
          // qui serait de toute façon refusée par la limite « une réservation
          // active par créneau » — et, en mode journée, par son équivalent sur
          // les périodes qui se chevauchent.
          const key = cartItemKey(item)
          const existing = state.items.findIndex(
            (i) => cartItemKey(i) === key,
          )
          if (existing === -1) return { items: [...state.items, item] }

          const items = [...state.items]
          items[existing] = item
          return { items }
        }),

      remove: (key) =>
        set((state) => ({
          items: state.items.filter((i) => cartItemKey(i) !== key),
        })),

      setParticipants: (key, participants) =>
        set((state) => ({
          items: state.items.map((i) =>
            cartItemKey(i) === key ? { ...i, participants } : i,
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'mauriexplore-cart',
      storage: createJSONStorage(() => localStorage),
      // Les lignes d'avant le lot B portaient `slotId` et `pricePerPerson` à la
      // racine, sans `mode`. Elles ne sont plus lisibles par l'union
      // discriminée : gardées, elles auraient produit des lignes sans mode que
      // chaque écran aurait interprétées différemment.
      //
      // On les JETTE plutôt que de les convertir : un panier n'engage rien,
      // aucune place n'y est retenue, et le coût pour le visiteur est de
      // resélectionner un départ. Écrire un convertisseur pour cela, c'était
      // maintenir pour toujours un chemin de lecture que plus rien ne teste.
      version: 1,
      migrate: () => ({ items: [] }),
      // `hasHydrated` ne doit pas être relu depuis le stockage : c'est un état
      // de session, pas une donnée du panier.
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)

/**
 * Totaux du panier.
 *
 * Les montants passent par `computeBookingAmounts`, la MÊME fonction que le
 * serveur : l'acompte affiché au panier est donc calculé exactement comme
 * celui qui sera débité. Réimplémenter les 20 % ici ferait diverger l'affichage
 * du montant réel dès le premier arrondi.
 */
export function useCartTotals(): CartTotals {
  const items = useCartStore((s) => s.items)

  return useMemo(() => {
    let totalPrice = 0
    let totalDeposit = 0
    let totalOnSite = 0

    for (const item of items) {
      // Le prix unitaire ET la quantité dépendent tous deux du mode. Multiplier
      // par `participants` dans les deux cas facturait la Jeep une fois par
      // occupant.
      const amounts = computeBookingAmounts(
        item.pricePerUnit,
        cartItemUnits(item),
      )
      totalPrice += amounts.totalPrice
      totalDeposit += amounts.depositDue
      totalOnSite += amounts.balanceDueOnSite
    }

    return {
      items,
      itemCount: items.length,
      totalPrice,
      totalDeposit,
      totalOnSite,
    }
  }, [items])
}

/**
 * `false` tant que localStorage n'a pas été relu.
 *
 * Le serveur rend forcément un panier vide : afficher directement le contenu
 * restauré produirait une erreur d'hydratation React. Les pages s'en servent
 * pour montrer un état de chargement pendant ce premier instant.
 */
export function useCartHydrated(): boolean {
  return useCartStore((s) => s.hasHydrated)
}

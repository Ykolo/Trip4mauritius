'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { computeBookingAmounts } from '@/lib/pricing'
import type { CartItem, CartTotals } from '@/types/cart'

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
  /** Remplace la ligne si le créneau est déjà au panier. */
  add: (item: CartItem) => void
  remove: (slotId: string) => void
  setParticipants: (slotId: string, participants: number) => void
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
          // Le créneau est la clé : ré-ajouter le même départ ajuste la ligne
          // existante au lieu d'en créer une seconde, qui serait de toute façon
          // refusée par la limite « une réservation active par créneau ».
          const existing = state.items.findIndex((i) => i.slotId === item.slotId)
          if (existing === -1) return { items: [...state.items, item] }

          const items = [...state.items]
          items[existing] = item
          return { items }
        }),

      remove: (slotId) =>
        set((state) => ({
          items: state.items.filter((i) => i.slotId !== slotId),
        })),

      setParticipants: (slotId, participants) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.slotId === slotId ? { ...i, participants } : i,
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'mauriexplore-cart',
      storage: createJSONStorage(() => localStorage),
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
      const amounts = computeBookingAmounts(
        item.pricePerPerson,
        item.participants,
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

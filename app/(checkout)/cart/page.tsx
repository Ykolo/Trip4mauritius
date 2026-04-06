'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/hooks/useCart'
import { CartItemRow } from '@/components/ui/CartItemRow'
import { CartSummary } from '@/components/ui/CartSummary'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

export default function CartPage() {
  const { data, isLoading, setItems } = useCart()

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    },
    [setItems]
  )

  const handleUpdateParticipants = useCallback(
    (itemId: string, participants: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item
          const depositPerPerson = item.depositAmount / item.participants
          return {
            ...item,
            participants,
            depositAmount: depositPerPerson * participants,
          }
        })
      )
    },
    [setItems]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-semibold text-ink mb-6">Your Cart</h1>
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

  // Empty state
  if (data.items.length === 0) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-8xl mb-6">🏖️</div>
          <h1 className="text-2xl font-semibold text-ink mb-2">
            Your cart is empty
          </h1>
          <p className="text-muted mb-6">
            Discover amazing activities in Mauritius
          </p>
          <Link
            href="/activities"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-transform"
          >
            <ShoppingBag className="w-5 h-5" />
            Browse Activities
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink mb-6">
          Your Cart ({data.items.length})
        </h1>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Items list */}
          <div className="space-y-4">
            {data.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onRemove={handleRemoveItem}
                onUpdate={handleUpdateParticipants}
              />
            ))}
          </div>

          {/* Summary - sticky on desktop */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <CartSummary
              itemCount={data.items.length}
              totalDeposit={data.total}
              totalOnSite={data.totalOnSite}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

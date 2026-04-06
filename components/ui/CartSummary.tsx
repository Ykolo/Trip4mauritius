import Link from 'next/link'

interface CartSummaryProps {
  itemCount: number
  totalDeposit: number
  totalOnSite: number
}

export function CartSummary({
  itemCount,
  totalDeposit,
  totalOnSite,
}: CartSummaryProps) {
  return (
    <div className="rounded-2xl shadow-card bg-white p-6 space-y-4">
      <h2 className="text-lg font-semibold text-ink">Order Summary</h2>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Items</span>
          <span className="font-medium">{itemCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted">Deposit due now</span>
          <span className="text-accent font-bold text-xl">
            &euro;{totalDeposit.toFixed(0)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted">Balance on-site</span>
          <span className="text-muted">&euro;{totalOnSite.toFixed(0)}</span>
        </div>
      </div>

      <hr className="border-surface" />

      <Link
        href="/checkout"
        className="block w-full bg-primary text-white text-center font-semibold py-4 rounded-2xl active:scale-95 transition-transform"
      >
        Proceed to Checkout
      </Link>

      <p className="text-xs text-muted text-center">
        You&apos;ll pay only the deposit now. The balance is due on-site.
      </p>
    </div>
  )
}

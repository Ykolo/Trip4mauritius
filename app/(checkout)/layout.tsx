import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface border-b border-muted/20">
        <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-ink active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body text-sm font-medium">Retour</span>
          </Link>
          <div className="flex items-center gap-1.5 text-green-600">
            <Lock className="w-4 h-4" />
            <span className="font-body text-xs font-semibold uppercase tracking-wider">Paiement Sécurisé</span>
          </div>
        </div>
      </header>
      
      <main className="pt-14 min-h-screen bg-gray-50 pb-safe">
        {children}
      </main>
    </>
  );
}

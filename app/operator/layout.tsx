import { OperatorSidebar } from "@/components/layout/OperatorSidebar";
import { OperatorBottomBar } from "@/components/layout/OperatorBottomBar";
import { OperatorGuard } from "@/components/layout/OperatorGuard";

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]"> {/* Slightly different grey to contrast with tourist site */}

      {/* Composant de Navigation Desktop (fixe à gauche) */}
      <OperatorSidebar />

      {/* Le conteneur principal qui reçoit la page */}
      <main className="flex-1 pb-16 md:pb-0 w-full overflow-x-hidden">
        {/* Le garde entoure UNIQUEMENT le contenu : la navigation reste
            visible pendant la demande d'accès, sans quoi un touriste arrivé
            là se retrouverait sur un écran sans sortie. */}
        <OperatorGuard>{children}</OperatorGuard>
      </main>

      {/* Composant de Navigation Mobile (masqué sur desktop) */}
      <OperatorBottomBar />

    </div>
  );
}

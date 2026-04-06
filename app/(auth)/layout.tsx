import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base flex flex-col">
      <header className="absolute top-0 left-0 w-full h-16 flex items-center px-4 md:px-8 z-50">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-ink hover:text-primary transition-colors active:scale-95"
          aria-label="Retour à l'accueil"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Retour</span>
        </Link>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Logo Centré au dessus du formulaire */}
        <div className="mb-8 text-center mt-12 md:mt-0">
          <Link href="/">
            <span className="font-display text-4xl text-primary drop-shadow-sm">Trip4mauritius</span>
          </Link>
        </div>
        
        {/* Wrapper central pour les formulaires (login/register) */}
        <div className="w-full max-w-sm bg-surface p-8 rounded-3xl shadow-card border border-muted/10 relative z-10">
          {children}
        </div>
      </main>

      {/* Decorative Blob pattern (Glassmorphism tropical touch) */}
      <div className="fixed top-1/4 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10 absolute pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 absolute pointer-events-none" />
    </div>
  );
}

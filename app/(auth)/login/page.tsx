import Link from 'next/link';

export default function LoginPage() {
  return (
    <>
      <h1 className="font-body font-bold text-2xl text-ink mb-2 text-center">Bon retour !</h1>
      <p className="text-sm text-center text-muted mb-8">Connectez-vous pour retrouver vos réservations</p>
      
      <form className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-ink mb-1.5 block uppercase tracking-wide">Email</label>
          <input type="email" placeholder="voyageur@email.com" className="w-full h-12 px-4 rounded-xl border border-muted/30 bg-base text-ink focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink mb-1.5 block uppercase tracking-wide">Mot de passe</label>
          <input type="password" placeholder="••••••••" className="w-full h-12 px-4 rounded-xl border border-muted/30 bg-base text-ink focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <button type="button" className="w-full bg-accent text-white h-12 rounded-xl font-bold mt-4 shadow-sm active:scale-95 transition-transform">
          Se connecter
        </button>
      </form>
      
      <div className="mt-6 flex flex-col gap-3 text-center">
        <Link href="#" className="text-xs text-muted hover:text-ink">Mot de passe oublié ?</Link>
        <p className="text-xs text-muted">
          Pas encore de compte ? <Link href="/register" className="text-primary font-bold hover:underline">S'inscrire</Link>
        </p>
      </div>
    </>
  );
}

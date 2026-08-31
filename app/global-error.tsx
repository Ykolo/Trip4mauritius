'use client'

// Dernier filet : il ne se déclenche que si `app/layout.tsx` lui-même échoue.
//
// À ce stade le layout racine n'a pas été rendu, donc ce composant doit fournir
// ses propres <html> et <body> — c'est le seul endroit du projet où c'est le
// cas. Les polices et les variables de thème ne sont pas garanties non plus :
// le style est écrit en dur plutôt qu'en classes utilitaires, pour que l'écran
// reste lisible même si la feuille de styles n'a pas chargé.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#F8FAFC',
          color: '#0F172A',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>
            Le site est momentanément indisponible
          </h1>
          <p style={{ color: '#64748B', margin: '0 0 2rem', lineHeight: 1.6 }}>
            Une erreur nous empêche d&apos;afficher cette page. Merci de
            réessayer dans un instant.
          </p>

          <button
            onClick={reset}
            style={{
              border: 0,
              cursor: 'pointer',
              padding: '0.875rem 1.75rem',
              borderRadius: '1rem',
              backgroundColor: '#06B6D4',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            Réessayer
          </button>

          {error.digest && (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#94A3B8' }}>
              Référence de l&apos;incident :{' '}
              <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
            </p>
          )}
        </div>
      </body>
    </html>
  )
}

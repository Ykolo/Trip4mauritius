import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Confort d'UX, PAS une autorisation.
 *
 * `getSessionCookie` ne fait que lire un cookie : il ne valide pas la session
 * en base. C'est délibéré — ce fichier s'exécute sur chaque navigation, une
 * requête base à chaque fois coûterait cher pour un gain nul. Un cookie forgé
 * passerait donc ce filtre.
 *
 * La vraie autorisation vit dans les procédures tRPC (`server/trpc/init.ts`),
 * qui, elles, valident la session côté serveur. Un proxy ne protège de toute
 * façon pas un appel d'API direct.
 *
 * `proxy.ts` et non `middleware.ts` : Next 16 a renommé la convention, et le
 * proxy tourne désormais sur le runtime Node.js par défaut. L'option `runtime`
 * n'y est pas acceptée — la poser lève une erreur.
 */

// `/checkout` est privé : une réservation appartient à un compte
// (`Booking.userId` n'est pas nullable). Sans ça, l'utilisateur remplirait tout
// le tunnel pour se heurter à un UNAUTHORIZED au dernier clic. `/cart` reste
// public — un panier n'engage rien et vit dans le navigateur.
const PRIVATE_PREFIXES = [
  '/account',
  '/bookings',
  '/operator',
  '/checkout',
  '/admin',
]
const AUTH_PAGES = ['/login', '/register']

/**
 * Une destination venue de l'URL ne doit jamais pouvoir renvoyer vers un autre
 * domaine. On n'accepte qu'un chemin interne — `//evil.com` est une URL
 * protocol-relative, d'où le second test.
 */
function isInternalPath(target: string): boolean {
  return target.startsWith('/') && !target.startsWith('//')
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = getSessionCookie(request) !== null

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isPrivate && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const target = `${pathname}${search}`
    if (isInternalPath(target)) {
      url.searchParams.set('redirect', target)
    }
    return NextResponse.redirect(url)
  }

  // Déjà connecté : les pages de connexion n'ont plus de sens.
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Ce fichier ne filtre QUE sur la présence d'une session — jamais sur le
  // rôle : celui-ci vient du cache de session (5 min) et s'y fier ici
  // produirait de fausses redirections à l'expiration.
  //
  // Le cloisonnement par rôle est appliqué là où il compte : `operatorProcedure`
  // et `adminProcedure` côté serveur, doublés côté écran par `OperatorGuard` et
  // `AdminGuard` — qui ne décident de rien, ils affichent la réponse du serveur.
  matcher: [
    '/account/:path*',
    '/bookings/:path*',
    '/operator/:path*',
    '/checkout/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
}

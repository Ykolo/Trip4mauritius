import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'

// Route Handler nu, comme le futur webhook Stripe et pour la même raison : le
// protocole n'est pas le nôtre. `handleUpload` négocie en deux temps avec le
// navigateur — il émet d'abord un jeton signé, puis reçoit le rappel de Vercel
// Blob une fois le fichier déposé — et attend le corps brut. tRPC ne peut pas
// porter ça.
//
// L'envoi est CLIENT-SIDE : le fichier va du navigateur directement à Vercel
// Blob, sans transiter par cette fonction. Un envoi côté serveur ferait passer
// chaque photo par la mémoire d'une fonction, pour rien.
//
// Runtime Node.js, comme partout dans ce projet.
export const runtime = 'nodejs'

/** Les rôles autorisés à déposer un fichier. Mêmes listes que `server/trpc/init.ts`. */
const CAN_UPLOAD: UserRole[] = ['operator', 'admin', 'superadmin']

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

/** 8 Mo. Au-delà, c'est une photo qu'il fallait redimensionner avant. */
const MAX_SIZE_BYTES = 8 * 1024 * 1024

/**
 * Diagnostic, consulté par le client APRÈS un échec — jamais avant.
 *
 * `upload()` ne remonte pas ce que cette route a répondu : dès que le POST
 * ci-dessous rend autre chose qu'un jeton, la bibliothèque jette un « Failed to
 * retrieve the client token » identique pour un refus de rôle, un stockage
 * absent ou un fichier trop lourd (`retrieveClientToken`, dans
 * `@vercel/blob/dist/client.js`). L'opérateur lisait donc un message qui ne
 * désignait aucun geste — et surtout pas celui qu'il fallait faire.
 *
 * Sonder à l'affichage du formulaire aurait coûté une requête à chaque montage
 * pour une réponse presque toujours « tout va bien ». On ne demande la raison
 * qu'une fois qu'il y en a une.
 *
 * Toujours 200, y compris pour un refus : ce n'est pas la tentative d'envoi,
 * c'est la question « pourquoi a-t-elle échoué ». L'autorisation reste posée
 * sur le POST.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  const role = (session?.user as { role?: UserRole } | undefined)?.role

  if (!role || !CAN_UPLOAD.includes(role)) {
    return NextResponse.json({
      ready: false,
      error: "Vous n'avez pas le droit d'envoyer un fichier.",
    })
  }

  // La cause réelle aujourd'hui : le store Blob n'est pas provisionné, donc
  // `handleUpload` échoue sur le jeton manquant avant même de jouer ses
  // rappels. Rien à corriger dans le formulaire — c'est une variable à poser.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      ready: false,
      error:
        "L’envoi de photos n’est pas encore activé sur ce site (stockage non configuré). En attendant, collez l’URL d’une image déjà en ligne.",
    })
  }

  return NextResponse.json({ ready: true })
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  // Cette route reçoit DEUX appelants, et un seul des deux a une session.
  //
  //  - `blob.generate-client-token` vient du navigateur d'un utilisateur
  //    connecté. C'est celui qu'il faut autoriser.
  //  - `blob.upload-completed` vient des serveurs de Vercel Blob, une fois le
  //    fichier déposé. Aucun cookie, donc aucune session — il est authentifié
  //    par la signature `x-vercel-signature`, que `handleUpload` vérifie.
  //
  // Exiger une session sur les deux renverrait 403 au rappel de Vercel.
  if (body.type === 'blob.generate-client-token') {
    // L'AUTORISATION EST ICI, avant `handleUpload`.
    //
    // La tentation était de ne la poser que dans `onBeforeGenerateToken`.
    // Ç'aurait marché, mais la garantie aurait dépendu de l'ordre dans lequel
    // la bibliothèque appelle ses rappels — un détail d'implémentation, pas un
    // contrat. Vérifié : sans `BLOB_READ_WRITE_TOKEN`, `handleUpload` échoue
    // sur le jeton manquant AVANT d'avoir joué le rappel. Le contrôle d'accès
    // n'a rien à faire derrière une porte que quelqu'un d'autre tient.
    //
    // Il ne peut pas non plus vivre côté client : le formulaire
    // d'administration est protégé par `proxy.ts`, mais celui-ci ne lit qu'un
    // cookie — c'est du confort d'UX, pas une autorisation.
    const session = await auth.api.getSession({ headers: request.headers })
    const role = (session?.user as { role?: UserRole } | undefined)?.role

    // Repli sur `tourist` : un rôle absent n'est jamais un privilège.
    if (!role || !CAN_UPLOAD.includes(role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas le droit d'envoyer un fichier." },
        { status: 403 },
      )
    }
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          // Vercel Blob suffixe le nom d'un aléa : deux « plage.jpg » envoyés
          // par deux opérateurs ne s'écrasent pas.
          addRandomSuffix: true,
        }
      },
      // Appelé par Vercel Blob une fois le fichier déposé. On n'a rien à y
      // faire : l'URL est renvoyée au navigateur, qui la pose dans le
      // formulaire, et c'est l'enregistrement de la fiche qui la persiste.
      // Écrire ici créerait une image en base sans fiche pour la porter.
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "L'envoi a échoué."

    // 400 et non 500 : les refus prévus par `handleUpload` (type de fichier,
    // taille, jeton de stockage absent) passent par cette branche, et le client
    // affiche le message tel quel. Le refus de rôle, lui, est renvoyé plus haut
    // en 403 — ce n'est pas la même erreur et elle n'appelle pas le même geste.
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

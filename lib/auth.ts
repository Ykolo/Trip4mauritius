import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from '@/lib/db'

// Fournisseurs sociaux activés UNIQUEMENT si leurs clés sont présentes.
// Sans ce garde, l'application planterait au démarrage tant que Google et Apple
// ne sont pas configurés. Les ajouter plus tard ne demandera que des variables
// d'environnement — aucun code à réécrire.
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // ⚠️ Vérification d'email désactivée faute de fournisseur d'envoi (Resend).
    // Acceptable avant lancement, mais À RÉACTIVER avant toute mise en ligne :
    // en l'état, on peut s'inscrire avec l'adresse de quelqu'un d'autre.
    requireEmailVerification: false,
    minPasswordLength: 12,
  },

  socialProviders,

  user: {
    additionalFields: {
      // `input: false` est CRITIQUE : sans lui, le rôle serait acceptable dans
      // le corps de la requête d'inscription et n'importe qui pourrait se
      // créer un compte admin. Le rôle ne se change que côté serveur.
      role: {
        type: 'string',
        defaultValue: 'tourist',
        input: false,
      },
      locale: {
        type: 'string',
        defaultValue: 'fr',
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24, // prolongée au plus une fois par jour
    cookieCache: {
      enabled: true,
      // Le rôle voyage dans la session : une promotion opérateur/admin ne prend
      // donc effet qu'au rafraîchissement du cache. Court volontairement.
      maxAge: 5 * 60,
    },
  },

  advanced: {
    database: {
      generateId: false, // on laisse Prisma générer les cuid()
    },
  },
})

export type Session = typeof auth.$Infer.Session

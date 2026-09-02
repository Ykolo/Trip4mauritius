'use client'

import { createContext, useContext } from 'react'
import { FEATURE_DEFAULTS, type FeatureKey, type FeatureMap } from '@/lib/features'

// Les flags arrivent RÉSOLUS depuis le layout serveur, en props — pas via une
// requête client.
//
// Deux raisons. D'abord le scintillement : un flag chargé après l'hydratation
// afficherait le formulaire « Devenir opérateur » une demi-seconde avant de le
// retirer. Ensuite le coût : ce serait un aller-retour réseau sur chaque page
// pour décider d'afficher un bouton.
//
// C'est aussi ce qui manque au sélecteur de devise du pied de page, dont l'état
// vit dans un `useState` local : invisible du serveur, invisible des autres
// composants.

const FeatureContext = createContext<FeatureMap>(FEATURE_DEFAULTS)

export function FeatureProvider({
  features,
  children,
}: {
  features: FeatureMap
  children: React.ReactNode
}) {
  return (
    <FeatureContext.Provider value={features}>
      {children}
    </FeatureContext.Provider>
  )
}

/**
 * ⚠️ Cache un écran, ne protège rien. Une fonctionnalité qui écrit ou expose
 * des données doit AUSSI être fermée côté serveur via `withFeature()`
 * (`server/trpc/init.ts`).
 */
export function useFeature(key: FeatureKey): boolean {
  return useContext(FeatureContext)[key]
}

export function useFeatures(): FeatureMap {
  return useContext(FeatureContext)
}

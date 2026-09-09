import { billedDays } from '@/lib/pricing'
import type { CartItem } from '@/types/cart'

// Identité et quantité facturée d'une ligne de panier — deux fonctions PURES.
//
// Séparées du store (`lib/stores/cart.ts`) pour la même raison que
// `lib/pricing.ts` l'est du service de réservation : elles portent une règle
// métier, et une règle métier doit pouvoir être testée sans monter ce qui
// l'entoure. Le store est marqué `'use client'` et instancie Zustand à
// l'import — les tests tournent en environnement Node, sans `localStorage`.

/**
 * Identité d'une ligne de panier.
 *
 * Le `slotId` seul ne pouvait plus servir de clé : une location à la journée
 * n'en a pas. La clé est donc composite et PRÉFIXÉE par le mode, même grammaire
 * que le `lockKey` du serveur (`server/services/booking.ts`) — sans le préfixe,
 * un id de créneau et un id d'activité pourraient se confondre.
 *
 * La période fait partie de la clé en mode journée : louer la même Jeep du 12
 * au 14 puis du 20 au 22 est parfaitement légitime et doit donner DEUX lignes.
 * Ne garder que l'activité aurait écrasé silencieusement la première période.
 */
export function cartItemKey(item: CartItem): string {
  return item.mode === 'daily'
    ? `daily:${item.activityId}:${item.period.startDate}T${item.period.startTime}:${item.period.endDate}T${item.period.endTime}`
    : `slot:${item.slotId}`
}

/**
 * Quantité facturée pour une ligne — ce par quoi le prix unitaire se multiplie.
 *
 * C'est ICI que vit la règle de tarification des deux modes, en un seul
 * endroit : par personne sur un créneau, par JOUR sur une location. Le prix
 * d'une Jeep ne dépend pas du nombre d'occupants — `maxParticipants` en est le
 * nombre de places, pas un multiplicateur.
 *
 * Si le client tranchait un jour pour un prix par personne ET par jour, c'est
 * cette ligne-ci qui changerait (`… * item.participants`), avec sa jumelle dans
 * `createDailyBooking`. Rien d'autre.
 */
export function cartItemUnits(item: CartItem): number {
  if (item.mode === 'slot') return item.participants

  // Le `Z` n'affirme pas que ces heures sont UTC : il neutralise le fuseau du
  // navigateur pour que les deux bornes soient construites avec le MÊME
  // décalage. `billedDays` ne lit que leur différence, qui est donc exacte où
  // qu'on soit. Sans lui, `new Date('2026-09-12T09:00')` serait interprété en
  // heure locale et une période à cheval sur un changement d'heure aurait
  // changé de durée.
  return billedDays(
    new Date(`${item.period.startDate}T${item.period.startTime}:00Z`),
    new Date(`${item.period.endDate}T${item.period.endTime}:00Z`),
  )
}

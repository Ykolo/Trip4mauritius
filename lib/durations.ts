/**
 * Les 4 durées d'activité — source unique.
 *
 * La base mélangeait deux vocabulaires : `Full day` et `Half day` pour les
 * excursions, `Journée` et `Plusieurs jours` pour les véhicules. Le tiroir de
 * filtres, lui, ne proposait que du français. Résultat : « Demi-journée » ne
 * renvoyait jamais rien, et « Journée » ne sortait que les locations de
 * véhicules en laissant de côté toutes les excursions à la journée.
 *
 * Le français l'emporte — c'est ce que le visiteur lit — et la migration
 * `normalize_activity_durations` a réécrit les deux valeurs anglaises. La
 * valeur stockée est donc aussi celle affichée et celle qui voyage dans l'URL.
 *
 * Toute écriture d'activité doit s'y tenir : `activityWriteSchema` refuse
 * désormais une durée hors de cette liste, sinon un opérateur ressusciterait
 * `Full day` à la première saisie et son activité redeviendrait introuvable.
 */
export const DURATIONS = ['< 2h', 'Demi-journée', 'Journée', 'Plusieurs jours'] as const

export type Duration = (typeof DURATIONS)[number]

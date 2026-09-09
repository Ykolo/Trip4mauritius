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

/**
 * Le libellé de filtre correspondant à une durée réelle, en minutes.
 *
 * Depuis que l'admin saisit la durée d'une activité sur créneau
 * (`Activity.durationMinutes`), le libellé n'est plus choisi mais DÉRIVÉ. Deux
 * saisies pour une même réalité — « 2 h » d'un côté, « Journée » de l'autre —
 * auraient divergé au premier oubli, et l'activité serait devenue introuvable
 * dans le tiroir de filtres alors même que sa fiche affiche la bonne durée.
 *
 * Les bornes sont choisies pour que la conversion soit RÉCIPROQUE de celle du
 * rétro-remplissage de `20260909140000_add_booking_mode` (90, 240, 480, 1440) :
 * une activité migrée puis réenregistrée sans changement doit retrouver
 * exactement son libellé d'origine. C'est ce qui interdit de placer la
 * frontière de « Journée » à 1440.
 *
 * Ne s'applique PAS aux activités à la journée : c'est le touriste qui y choisit
 * la durée, il n'y a donc rien à dériver et l'admin garde la main.
 */
export function durationLabel(minutes: number): Duration {
  if (minutes < 120) return '< 2h'
  if (minutes < 360) return 'Demi-journée'
  if (minutes <= 720) return 'Journée'
  return 'Plusieurs jours'
}

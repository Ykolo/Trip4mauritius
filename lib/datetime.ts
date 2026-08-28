// Maurice est à UTC+4 et n'observe AUCUN changement d'heure.
//
// Tout affichage d'horaire d'activité doit passer par ce module. Formater dans
// le fuseau du navigateur afficherait un départ de 09:00 à 07:00 pour un
// touriste connecté depuis Paris — sans lever la moindre erreur, et en lui
// faisant rater son excursion.

export const MAURITIUS_TZ = 'Indian/Mauritius'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MAURITIUS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MAURITIUS_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Date locale mauricienne, format `YYYY-MM-DD`. */
export function mauritiusDate(instant: Date): string {
  return dateFormatter.format(instant)
}

/** Heure locale mauricienne, format `HH:mm`. */
export function mauritiusTime(instant: Date): string {
  return timeFormatter.format(instant)
}

/**
 * Instant UTC correspondant à une heure murale mauricienne.
 * L'offset étant fixe, un simple décalage suffit — pas de gestion de DST.
 */
export function fromMauritiusWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 4, minute, 0, 0))
}

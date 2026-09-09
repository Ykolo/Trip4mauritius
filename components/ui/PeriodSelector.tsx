'use client'

import { fr } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'

// Choix de la période, en mode journée.
//
// Le pendant de `SlotSelector` : là où une activité sur créneau propose des
// départs déjà publiés, une location laisse le touriste composer sa propre
// période. Il n'y a donc rien à lire en base pour peindre cet écran — la
// disponibilité ne se vérifie qu'à la réservation, sous verrou, parce qu'elle
// dépend de ce que les autres auront réservé entre-temps.

/**
 * Heures de retrait et de restitution, tant que l'opérateur ne les paramètre pas.
 *
 * Le choix de 09:00 → 18:00 n'est pas décoratif : il fait tomber juste le
 * comptage « toute tranche de 24 h entamée = 1 jour » de `billedDays` sur la
 * lecture naturelle d'une location. Du 12 au 12 = 9 h = 1 jour ; du 12 au 14 =
 * 57 h = 3 jours — soit exactement les trois journées pendant lesquelles le
 * véhicule n'est pas chez le loueur.
 *
 * Avec un retour à 09:00, une sélection d'un seul jour aurait produit une
 * période de durée NULLE, que `createDailyBooking` refuse : le touriste aurait
 * buté sur « la date de fin doit être postérieure » après tout le tunnel.
 */
export const DEFAULT_PICKUP_TIME = '09:00'
export const DEFAULT_RETURN_TIME = '18:00'

export interface SelectedPeriod {
  startDate: string
  endDate: string
}

interface PeriodSelectorProps {
  value: SelectedPeriod | null
  onChange: (period: SelectedPeriod | null) => void
}

/**
 * `YYYY-MM-DD` mauricien à partir d'un `Date` de react-day-picker.
 *
 * Le calendrier rend des `Date` à MINUIT LOCAL du navigateur. `toISOString()`
 * les convertirait en UTC et reculerait d'un jour pour tout visiteur à l'est de
 * Greenwich — un Mauricien qui clique le 12 réserverait le 11. On relit donc
 * les champs locaux, qui sont exactement ceux qu'il a cliqués.
 */
function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** L'inverse, pour repeindre la sélection sans passer par le fuseau. */
function fromDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const selected: DateRange | undefined = value
    ? { from: fromDateString(value.startDate), to: fromDateString(value.endDate) }
    : undefined

  // Aujourd'hui à minuit local : `createDailyBooking` refuse toute période déjà
  // commencée, autant ne pas la laisser cliquer.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) return onChange(null)

    // react-day-picker ne renseigne `to` qu'au second clic. Entre les deux, la
    // période est incomplète : la remonter telle quelle aurait affiché un prix
    // pour une location sans date de retour.
    if (!range.to) return onChange(null)

    onChange({
      startDate: toDateString(range.from),
      endDate: toDateString(range.to),
    })
  }

  return (
    <section className="py-6">
      <h2 className="font-semibold text-xl text-ink mb-1">
        Choisissez votre période
      </h2>
      <p className="text-muted text-sm mb-4">
        Cliquez la date de retrait, puis celle de restitution. Retrait à{' '}
        {DEFAULT_PICKUP_TIME}, retour à {DEFAULT_RETURN_TIME}. Une même journée
        se sélectionne en cliquant deux fois la même date.
      </p>

      <div className="flex justify-center">
        <Calendar
          mode="range"
          locale={fr}
          selected={selected}
          onSelect={handleSelect}
          disabled={{ before: today }}
          className="rounded-2xl border border-surface"
        />
      </div>
    </section>
  )
}

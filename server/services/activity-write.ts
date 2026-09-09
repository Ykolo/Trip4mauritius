import { db } from '@/lib/db'
import { durationLabel } from '@/lib/durations'
import type { ActivityInput } from '@/lib/schemas/operator'

// Écriture d'activité — partie commune à l'espace opérateur et au back-office.
//
// Les deux surfaces diffèrent par QUI peut écrire et par ce que l'écriture
// déclenche (un opérateur qui modifie une fiche publiée la renvoie en
// modération ; un admin, non — il EST la modération). Elles ne diffèrent jamais
// par la forme des colonnes écrites. Dupliquer cette conversion aurait fait
// diverger les deux surfaces au premier champ ajouté au schéma, et le champ
// manquant côté admin ne se serait vu qu'à l'affichage d'une fiche incomplète.

/** Slug URL à partir du titre : minuscules, sans accents ni ponctuation. */
function slugify(title: string): string {
  return title
    .normalize('NFD')
    // Diacritiques combinants laissés par la décomposition NFD.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Slug unique.
 *
 * `slug` est en UNIQUE : deux opérateurs qui nomment leur sortie « Catamaran
 * Nord » se heurteraient sur une erreur Prisma incompréhensible. On suffixe
 * jusqu'à trouver libre. La boucle est bornée — au-delà, un aléa vaut mieux
 * qu'un blocage.
 */
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'activite'

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const taken = await db.activity.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }

  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `ActivityInput` → colonnes.
 *
 * Ni `operatorId`, ni `slug`, ni `status` : ce sont précisément les trois champs
 * que l'appelant a le devoir de décider lui-même. Les inclure ici les rendrait
 * copiables par inadvertance d'une surface à l'autre — c'est-à-dire publiables
 * sans modération, ou attribuables à l'opérateur d'un autre.
 */
export function toActivityWriteData(input: ActivityInput) {
  const slotMode = input.bookingMode === 'slot'

  return {
    title: input.title,
    categoryId: input.categoryId,
    region: input.region,

    bookingMode: input.bookingMode,

    // Chaque mode n'écrit QUE sa colonne, et remet l'autre à `null`. Sans ce
    // nettoyage, une fiche basculée de créneau à journée garderait sa durée —
    // et le prochain qui lirait `durationMinutes` croirait à une activité à
    // départ fixe. Les CHECK ne l'interdisent pas : ils exigent la colonne du
    // mode courant, ils ne vident pas l'autre.
    durationMinutes: slotMode ? (input.durationMinutes ?? null) : null,
    dailyUnits: slotMode ? null : (input.dailyUnits ?? null),

    // Le libellé de filtre est DÉRIVÉ en mode créneau, saisi en mode journée.
    // Voir `durationLabel` : deux saisies pour une même réalité divergeraient,
    // et l'activité sortirait des filtres sans que sa fiche change.
    duration:
      slotMode && input.durationMinutes !== undefined
        ? durationLabel(input.durationMinutes)
        : input.duration,
    // La colonne s'appelle `priceHt`, le contrat front `priceHT` : la bascule
    // n'a lieu qu'ici.
    priceHt: input.priceHT,
    maxParticipants: input.maxParticipants,
    languages: input.languages,
    imageUrls: input.imageUrls,
    included: input.included,
    excluded: input.excluded,
    description: input.description,
  }
}

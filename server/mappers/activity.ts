import type {
  Activity as DbActivity,
  ActivitySlot as DbSlot,
  Category as DbCategory,
  Operator as DbOperator,
} from '@prisma/client'
import { mauritiusDate, mauritiusTime } from '@/lib/datetime'
import { ACTIVITY_LOCALES } from '@/lib/schemas/activity'
import type {
  Activity,
  ActivityFull,
  ActivityOperator,
  ActivitySlot,
} from '@/types/activity'

// Point de conversion UNIQUE entre le modèle base et les types du front.
//
// La base stocke `spotsTaken` (compteur croissant, protégé par une contrainte),
// le front consomme `spotsLeft`. Cette conversion ne doit exister qu'ici :
// dupliquée ailleurs, elle divergera tôt ou tard.

const MINUTES_IN_DAY = 24 * 60

/**
 * `durationMinutes` vient de l'ACTIVITÉ, pas du créneau : c'est pourquoi il est
 * passé en second argument plutôt que lu sur `slot`. L'heure de fin est dérivée
 * ici, au point de conversion unique, et nulle part ailleurs — recalculée dans
 * un composant, elle aurait fini par utiliser le fuseau du navigateur, et un
 * départ de 09:00 se serait terminé à 09:00 pour un touriste à Paris.
 *
 * Au-delà de 24 h, l'heure de fin ne veut plus rien dire comme BORNE DE PLAGE :
 * une sortie de 24 h affichait « 09:00 – 09:00 », lu comme une durée nulle,
 * et une de 30 h « 09:00 – 15:00 », lu comme six heures. Le schéma autorise
 * jusqu'à 14 jours en mode créneau, ce cas n'est donc pas théorique. On rend
 * `null` : l'écran retombe sur la seule heure de départ, qui reste vraie.
 * Traverser minuit, en revanche, est parfaitement lisible — « 23:00 – 02:00 »
 * décrit bien une sortie de nuit.
 */
export function toActivitySlot(
  slot: DbSlot,
  durationMinutes: number | null,
): ActivitySlot {
  return {
    id: slot.id,
    date: mauritiusDate(slot.startsAt),
    time: mauritiusTime(slot.startsAt),
    endTime:
      durationMinutes === null || durationMinutes >= MINUTES_IN_DAY
        ? null
        : mauritiusTime(
            new Date(slot.startsAt.getTime() + durationMinutes * 60_000),
          ),
    spotsLeft: slot.maxSpots - slot.spotsTaken,
    maxSpots: slot.maxSpots,
  }
}

/**
 * Complète les langues manquantes à partir du français.
 *
 * La base ne stocke que les traductions réellement saisies (cf.
 * `activityDescriptionSchema`). Le contrat de sortie, lui, promet les 5 clés :
 * c'est ce repli qui tient la promesse, et il n'existe qu'ici. Dupliqué dans
 * les composants, il finirait par manquer sur l'un d'eux et afficherait du
 * vide.
 */
export function toDescription(raw: unknown): ActivityFull['description'] {
  const stored = (raw ?? {}) as Partial<Record<string, string>>
  const fallback = stored.fr ?? ''

  return Object.fromEntries(
    ACTIVITY_LOCALES.map((locale) => [locale, stored[locale] || fallback]),
  ) as ActivityFull['description']
}

export function toActivityOperator(operator: DbOperator): ActivityOperator {
  return {
    id: operator.id,
    name: operator.displayName,
    avatarUrl: operator.avatarUrl ?? '',
    verified: operator.verified,
  }
}

/**
 * La catégorie est désormais une relation, donc TOUTE lecture d'activité doit
 * l'inclure. Le type l'impose : une requête qui l'oublie ne compile pas.
 */
export type DbActivityWithCategory = DbActivity & { category: DbCategory }

export function toActivity(activity: DbActivityWithCategory): Activity {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    // Le front affiche le LIBELLÉ et filtre sur le SLUG. Les confondre, c'est
    // exactement le bug d'origine : les vignettes de l'accueil pointaient sur
    // `?category=diving` quand la base contenait « Water Sports ».
    category: activity.category.label,
    categorySlug: activity.category.slug,
    region: activity.region,
    duration: activity.duration,
    // `priceFrom` est DÉRIVÉ du prix par personne — jamais stocké.
    priceFrom: activity.priceHt.toNumber(),
    imageUrl: activity.imageUrls[0] ?? '',
    rating: activity.rating?.toNumber(),
    lang: activity.languages,
  }
}

export function toActivityFull(
  activity: DbActivityWithCategory & { operator: DbOperator; slots: DbSlot[] },
): ActivityFull {
  return {
    ...toActivity(activity),
    bookingMode: activity.bookingMode,
    durationMinutes: activity.durationMinutes,
    dailyUnits: activity.dailyUnits,
    maxParticipants: activity.maxParticipants,
    languages: activity.languages,
    imageUrls: activity.imageUrls,
    description: toDescription(activity.description),
    included: activity.included,
    excluded: activity.excluded,
    operator: toActivityOperator(activity.operator),
    slots: activity.slots.map((slot) =>
      toActivitySlot(slot, activity.durationMinutes),
    ),
    priceHT: activity.priceHt.toNumber(),
    reviewCount: activity.reviewCount,
  }
}

import type {
  Activity as DbActivity,
  ActivitySlot as DbSlot,
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

export function toActivitySlot(slot: DbSlot): ActivitySlot {
  return {
    id: slot.id,
    date: mauritiusDate(slot.startsAt),
    time: mauritiusTime(slot.startsAt),
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

export function toActivity(activity: DbActivity): Activity {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    category: activity.category,
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
  activity: DbActivity & { operator: DbOperator; slots: DbSlot[] },
): ActivityFull {
  return {
    ...toActivity(activity),
    maxParticipants: activity.maxParticipants,
    languages: activity.languages,
    imageUrls: activity.imageUrls,
    description: toDescription(activity.description),
    included: activity.included,
    excluded: activity.excluded,
    operator: toActivityOperator(activity.operator),
    slots: activity.slots.map(toActivitySlot),
    priceHT: activity.priceHt.toNumber(),
    reviewCount: activity.reviewCount,
  }
}

import type {
  Activity as DbActivity,
  ActivitySlot as DbSlot,
  Operator as DbOperator,
} from '@prisma/client'
import { mauritiusDate, mauritiusTime } from '@/lib/datetime'
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
    // Les 5 clés fr|en|de|es|ru sont garanties à l'écriture (validation Zod).
    description: activity.description as ActivityFull['description'],
    included: activity.included,
    excluded: activity.excluded,
    operator: toActivityOperator(activity.operator),
    slots: activity.slots.map(toActivitySlot),
    priceHT: activity.priceHt.toNumber(),
    reviewCount: activity.reviewCount,
  }
}

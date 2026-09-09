import { describe, expect, it } from 'vitest'
import type { ActivitySlot as DbSlot } from '@prisma/client'
import { toActivitySlot } from '@/server/mappers/activity'

// L'heure de fin d'un créneau est DÉRIVÉE, jamais stockée. Ce qu'on protège
// ici, c'est qu'elle le soit dans le fuseau de Maurice et nulle part ailleurs :
// un `toLocaleTimeString()` sans fuseau explicite passerait ces tests sur un
// poste réglé sur Maurice et afficherait 05:00 sur le serveur de production.

function slot(startsAt: Date): DbSlot {
  return {
    id: 'slot-1',
    activityId: 'act-1',
    startsAt,
    maxSpots: 10,
    spotsTaken: 2,
  } as DbSlot
}

describe('heure de fin dérivée', () => {
  it('ajoute la durée de l’activité à l’heure de départ', () => {
    // 05:00 UTC = 09:00 à Maurice (UTC+4, sans changement d'heure).
    const mapped = toActivitySlot(slot(new Date('2026-10-12T05:00:00Z')), 120)

    expect(mapped.time).toBe('09:00')
    expect(mapped.endTime).toBe('11:00')
  })

  it('reste nulle quand l’activité n’a pas de durée', () => {
    // Le cas des fiches saisies avant le lot B, sur lesquelles le
    // rétro-remplissage n'a rien pu déduire. L'affichage retombe alors sur la
    // seule heure de départ plutôt que d'inventer une fin.
    const mapped = toActivitySlot(slot(new Date('2026-10-12T05:00:00Z')), null)

    expect(mapped.endTime).toBeNull()
  })

  it('franchit minuit sans reculer d’un jour', () => {
    // Départ à 23:00 mauricien (19:00 UTC), 3 h de sortie : la fin est à 02:00
    // le lendemain. La date affichée reste celle du DÉPART — c'est celle du
    // rendez-vous, et la changer ferait chercher le bateau le mauvais jour.
    const mapped = toActivitySlot(slot(new Date('2026-10-12T19:00:00Z')), 180)

    expect(mapped.date).toBe('2026-10-12')
    expect(mapped.time).toBe('23:00')
    expect(mapped.endTime).toBe('02:00')
  })

  it('convertit toujours spotsTaken en spotsLeft', () => {
    // La base stocke le compteur croissant, le front lit ce qu'il reste. La
    // conversion n'existe qu'ici.
    expect(toActivitySlot(slot(new Date()), 60).spotsLeft).toBe(8)
  })
})

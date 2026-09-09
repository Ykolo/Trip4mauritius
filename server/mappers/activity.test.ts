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

  it('renonce à la plage au-delà de 24 h, plutôt que d’afficher une durée nulle', () => {
    // Une sortie de 24 h affichait « 09:00 – 09:00 » et une de 30 h
    // « 09:00 – 15:00 » : la première se lit comme une durée nulle, la seconde
    // comme six heures. Le schéma autorise jusqu'à 14 jours en mode créneau, le
    // cas n'est pas théorique. L'écran retombe sur l'heure de départ, qui reste
    // vraie.
    const start = new Date('2026-10-12T05:00:00Z')

    expect(toActivitySlot(slot(start), 24 * 60).endTime).toBeNull()
    expect(toActivitySlot(slot(start), 30 * 60).endTime).toBeNull()

    // Juste en dessous, la plage garde son sens — y compris à cheval sur minuit.
    expect(toActivitySlot(slot(start), 24 * 60 - 1).endTime).toBe('08:59')
  })

  it('convertit toujours spotsTaken en spotsLeft', () => {
    // La base stocke le compteur croissant, le front lit ce qu'il reste. La
    // conversion n'existe qu'ici.
    expect(toActivitySlot(slot(new Date()), 60).spotsLeft).toBe(8)
  })
})

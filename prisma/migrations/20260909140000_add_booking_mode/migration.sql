-- Deux modèles de vente : activité sur créneau, activité à la journée.
--
-- Le catalogue n'en connaissait qu'un — un départ à heure fixe avec des places.
-- Les 7 locations de véhicules du seed étaient donc vendues par créneaux
-- ponctuels, et personne ne pouvait louer une Jeep du mardi au jeudi.
--
-- Écrite À LA MAIN, comme toutes les migrations de ce projet depuis que le
-- checksum de `20260902120000_add_categories` diverge : `prisma migrate dev`
-- propose alors de RESETTER la base, qui est celle que sert le site. Voir
-- CLAUDE.md. Application par `prisma migrate deploy`.
--
-- Cette migration ne pose AUCUNE contrainte CHECK : elle remplit d'abord.
-- `20260909140100_add_booking_mode_checks` les ajoute ensuite, une fois les
-- données conformes. Fusionner les deux ferait échouer le tout sur une
-- contrainte violée par une ligne existante, sans qu'on puisse distinguer un
-- rétro-remplissage raté d'un invariant mal écrit.

-- ---------------------------------------------------------------------------
-- Activités
-- ---------------------------------------------------------------------------

CREATE TYPE "BookingMode" AS ENUM ('slot', 'daily');

ALTER TABLE "activities"
  -- `slot` par défaut : TOUTES les activités existantes gardent exactement le
  -- comportement qu'elles avaient. La bascule des véhicules en mode journée est
  -- une décision éditoriale, prise fiche par fiche depuis /admin/activities —
  -- la faire ici supprimerait leurs créneaux, donc annulerait les réservations
  -- déjà posées dessus.
  ADD COLUMN "bookingMode"     "BookingMode" NOT NULL DEFAULT 'slot',
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "dailyUnits"      INTEGER;

-- Rétro-remplissage de la durée réelle à partir du libellé éditorial, seule
-- information dont on dispose. Ce sont des ordres de grandeur, pas des
-- mesures : l'admin les corrigera fiche par fiche. Le `ELSE` couvre les
-- libellés hors liste, qu'aucune écriture ne produit plus depuis
-- `normalize_activity_durations` mais qui pourraient subsister.
UPDATE "activities" SET "durationMinutes" = CASE "duration"
  WHEN '< 2h'           THEN 90
  WHEN 'Demi-journée'   THEN 240
  WHEN 'Journée'        THEN 480
  WHEN 'Plusieurs jours' THEN 1440
  ELSE 240
END;

-- ---------------------------------------------------------------------------
-- Réservations
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings"
  ADD COLUMN "activityId" TEXT,
  ADD COLUMN "startsAt"   TIMESTAMPTZ(6),
  ADD COLUMN "endsAt"     TIMESTAMPTZ(6),
  ADD COLUMN "billedDays" INTEGER;

-- `activityId` et `startsAt` viennent du créneau pour tout l'existant. La
-- duplication de `startsAt` est assumée : la réservation FIGE la période
-- qu'elle engage, comme elle fige déjà `contactPhone`. C'est ce qui rend le
-- créneau réellement optionnel — le tri, le filtre de période et le mapper
-- cessent de traverser la relation.
UPDATE "bookings" b
   SET "activityId" = s."activityId",
       "startsAt"   = s."startsAt"
  FROM "activity_slots" s
 WHERE s."id" = b."slotId";

ALTER TABLE "bookings"
  ALTER COLUMN "activityId" SET NOT NULL,
  ALTER COLUMN "startsAt"   SET NOT NULL,
  -- Le créneau devient facultatif : une réservation à la journée n'en a pas.
  ALTER COLUMN "slotId"     DROP NOT NULL;

-- RESTRICT, comme `slots → bookings` : une activité réservée ne disparaît pas
-- sous les réservations qui la référencent. En mode journée, c'est le SEUL lien
-- qui les retient.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- L'index que lit le calcul de disponibilité : les réservations d'une activité
-- dont la période chevauche celle demandée.
CREATE INDEX "bookings_activityId_startsAt_idx" ON "bookings"("activityId", "startsAt");

-- Les invariants des deux modèles de vente.
--
-- Séparés du rétro-remplissage (`20260909140000_add_booking_mode`) : appliquer
-- une contrainte dans la transaction qui remplit les colonnes ferait tout
-- échouer sur une seule ligne récalcitrante, sans qu'on puisse distinguer un
-- remplissage raté d'un invariant mal écrit.
--
-- Ces CHECK-ci ne sont PAS du même ordre que les 4 valeurs éditoriales de
-- `lib/durations.ts`, pour lesquelles la migration `normalize_activity_durations`
-- avait délibérément renoncé à contraindre la base. Une liste de libellés est
-- une décision de vocabulaire qui bougera ; ce qui suit est structurel. En
-- particulier `activities_daily_requires_units` : toute la protection contre la
-- survente en mode journée repose sur `dailyUnits`, et une activité à la
-- journée sans stock la contournerait en silence.

-- ---------------------------------------------------------------------------
-- Activités : chaque mode exige SA colonne
-- ---------------------------------------------------------------------------

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_slot_requires_duration"
    CHECK ("bookingMode" <> 'slot' OR "durationMinutes" IS NOT NULL),

  -- Le plus important du lot. Sans stock, le comptage des chevauchements n'a
  -- rien à quoi se comparer et laisserait promettre deux fois la même voiture.
  ADD CONSTRAINT "activities_daily_requires_units"
    CHECK ("bookingMode" <> 'daily' OR "dailyUnits" IS NOT NULL),

  ADD CONSTRAINT "activities_duration_minutes_positive"
    CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0),

  ADD CONSTRAINT "activities_daily_units_positive"
    CHECK ("dailyUnits" IS NULL OR "dailyUnits" > 0);

-- ---------------------------------------------------------------------------
-- Réservations : la forme dépend du mode, et les deux ne se mélangent pas
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings"
  -- Une période qui finit avant de commencer ferait compter un nombre de jours
  -- négatif, donc un montant négatif — que `bookings_amounts_non_negative`
  -- refuserait, mais bien plus loin et avec un message illisible.
  ADD CONSTRAINT "bookings_period_ordered"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),

  ADD CONSTRAINT "bookings_billed_days_positive"
    CHECK ("billedDays" IS NULL OR "billedDays" > 0),

  -- L'invariant du discriminant : une réservation est SOIT sur créneau (elle a
  -- un créneau, et ni fin ni jours facturés — sa durée appartient à
  -- l'activité), SOIT à la journée (pas de créneau, mais une période complète
  -- et un nombre de jours figé). Aucun état intermédiaire n'a de sens, et c'est
  -- exactement le genre de ligne bâtarde qu'un bug de mapper produirait.
  ADD CONSTRAINT "bookings_mode_shape"
    CHECK (
      ("slotId" IS NOT NULL AND "endsAt" IS NULL     AND "billedDays" IS NULL)
      OR
      ("slotId" IS NULL     AND "endsAt" IS NOT NULL AND "billedDays" IS NOT NULL)
    );

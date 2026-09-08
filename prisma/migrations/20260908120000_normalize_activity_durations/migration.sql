-- Normalise le vocabulaire des durées.
--
-- La colonne `duration` a accumulé deux vocabulaires : l'anglais des excursions
-- (`Full day`, `Half day`) et le français des locations de véhicules
-- (`Journée`, `Plusieurs jours`). Le tiroir de filtres ne proposait que le
-- français : « Demi-journée » ne renvoyait donc JAMAIS rien, et « Journée »
-- laissait de côté toutes les excursions à la journée.
--
-- Le français l'emporte parce que c'est ce que le visiteur lit, et parce que
-- deux des quatre valeurs l'étaient déjà. `lib/durations.ts` fixe désormais la
-- liste, et `activityInputSchema` la fait respecter à l'écriture — sans quoi la
-- première saisie d'un opérateur ressusciterait `Full day`.
--
-- Idempotent : rejouée, la seconde exécution ne trouve plus aucune ligne.
--
-- Pas de contrainte CHECK ici, contrairement aux 9 du lot 1 : la liste des
-- durées est une décision éditoriale qui bougera (« Soirée », « Week-end »), et
-- la figer en base imposerait une migration à chaque ajout. La garantie qui
-- compte — aucune valeur inventée n'entre — est posée par Zod, à l'unique
-- endroit où les activités s'écrivent.

UPDATE "activities" SET "duration" = 'Journée'      WHERE "duration" = 'Full day';
UPDATE "activities" SET "duration" = 'Demi-journée' WHERE "duration" = 'Half day';

-- Les valeurs jamais utilisées par le seed mais proposées par l'ancien
-- formulaire opérateur (« 1 hour », « 2 hours », « 3 hours », « 2 days ») : si
-- une activité a été saisie à la main avec l'une d'elles, elle est aujourd'hui
-- introuvable par le filtre de durée.
UPDATE "activities" SET "duration" = '< 2h'           WHERE "duration" IN ('1 hour', '2 hours');
UPDATE "activities" SET "duration" = 'Demi-journée'   WHERE "duration" = '3 hours';
UPDATE "activities" SET "duration" = 'Plusieurs jours' WHERE "duration" = '2 days';

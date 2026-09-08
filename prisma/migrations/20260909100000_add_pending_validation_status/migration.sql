-- Nouvel état « Créée » : le touriste a réservé, l'opérateur n'a pas encore
-- validé qu'il prend le groupe.
--
-- Ajouté plutôt que recyclé depuis `pending_payment` : cette valeur-là est
-- réservée à l'arrivée de Stripe, et lui faire porter « en attente de
-- validation » aurait donné deux sens au même état le jour du branchement.
--
-- La valeur est ajoutée EN FIN d'énumération, comme le fait `ADD VALUE` par
-- défaut, et l'ordre de `schema.prisma` suit — sinon Prisma détecte une dérive
-- au prochain diff.
--
-- ⚠️ Cette migration ne fait QUE déclarer la valeur. Postgres interdit
-- d'utiliser une valeur d'enum dans la transaction qui l'ajoute ; poser le
-- nouveau défaut de colonne ici échouerait sur « unsafe use of new value of
-- enum type ». C'est l'objet de la migration suivante.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending_validation';

-- Le défaut de colonne suit le nouveau cycle de vie.
--
-- Migration SÉPARÉE de celle qui ajoute la valeur : Postgres refuse d'utiliser
-- une valeur d'énumération dans la transaction qui la déclare. Prisma exécute
-- chaque fichier de migration dans sa propre transaction, ce qui suffit.
--
-- Le service pose de toute façon le statut explicitement
-- (`server/services/booking.ts`). Ce défaut est un filet : une insertion qui
-- l'oublierait atterrissait jusqu'ici en « en attente de paiement », un état
-- qu'aucun écran ne sait faire avancer tant que Stripe n'existe pas.
--
-- Les réservations DÉJÀ en base ne sont pas touchées : elles ont été créées
-- directement en `confirmed`, ce qui reste vrai — elles étaient validées par
-- construction, faute d'étape de validation à l'époque.

ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_validation';

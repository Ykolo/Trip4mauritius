-- `ActivityStatus` retombe à trois états : draft, published, archived.
--
-- `pending_moderation` et `rejected` étaient les deux états de la file de
-- modération. Celle-ci a disparu au lot 13 — plus aucun chemin d'écriture ne
-- les pose depuis que `submitForModeration` est devenu `publishOwnActivity`.
-- Les laisser dans l'énumération, c'était garder deux valeurs que la colonne
-- peut prendre, que trois écrans savent afficher, et que plus rien ne produit :
-- la prochaine lecture de `types/activity.ts` aurait conclu à l'existence d'une
-- modération.
--
-- Comptage avant écriture (09/09/2026, branche `dev`) : 22 `published`,
-- 1 `draft`, ZÉRO ligne dans les deux états retirés. L'UPDATE ci-dessous est
-- donc défensif — il existe pour que la migration reste juste si elle est
-- rejouée sur une base plus ancienne, la branche `production` comprise.
--
-- Repli en brouillon, pas en archive : une fiche « refusée » ou « en attente »
-- est une fiche qu'on voulait mettre en ligne. L'archiver la sortirait du
-- catalogue sans que personne ne sache qu'elle en attendait l'entrée.
UPDATE "activities"
SET "status" = 'draft'
WHERE "status" IN ('pending_moderation', 'rejected');

-- Postgres ne sait pas retirer une valeur d'énumération : il faut reconstruire
-- le type. Le défaut de colonne s'y oppose (il référence l'ancien type), d'où
-- sa dépose puis sa repose à l'identique.
--
-- `ALTER COLUMN … TYPE` reconstruit lui-même l'index `activities_status_region_categoryId_idx`
-- qui porte sur cette colonne — rien à recréer à la main ici.
ALTER TABLE "activities" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ActivityStatus" RENAME TO "ActivityStatus_old";

CREATE TYPE "ActivityStatus" AS ENUM ('draft', 'published', 'archived');

ALTER TABLE "activities"
  ALTER COLUMN "status" TYPE "ActivityStatus"
  USING "status"::text::"ActivityStatus";

ALTER TABLE "activities" ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "ActivityStatus_old";

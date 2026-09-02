-- Catégories : de la colonne texte libre à une table administrable.
--
-- Migration écrite À LA MAIN. `prisma migrate dev` refuse de la générer sans
-- confirmation interactive parce qu'elle supprime `activities.category`, et
-- surtout parce qu'il ne saurait pas reprendre les valeurs existantes : entre
-- l'ajout de la colonne et la suppression de l'ancienne, il faut RECOPIER les
-- données. Un `db push` aurait détruit le contenu sans rien demander.
--
-- L'ordre compte : créer, remplir, rattacher, puis seulement supprimer.

-- ---------------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------------
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "categories_label_key" ON "categories"("label");
CREATE INDEX "categories_active_position_idx" ON "categories"("active", "position");

-- ---------------------------------------------------------------------------
-- 2. Reprise des 9 valeurs réellement présentes en base.
--
-- Les libellés sont repris TELS QUELS. Ils sont anglais sur un site
-- francophone, mais les renommer est une décision éditoriale du client, pas
-- quelque chose à figer dans une migration : /admin/categories permet
-- désormais de le faire en un clic, sans déploiement.
--
-- Les slugs, eux, sont francisés, sans accent ni espace — ce sont eux qui
-- voyagent dans l'URL, et ils ne doivent plus jamais changer ensuite.
-- ---------------------------------------------------------------------------
INSERT INTO "categories" ("id", "slug", "label", "emoji", "position", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'sports-nautiques', 'Water Sports', '🤿',  1, true, now(), now()),
  (gen_random_uuid()::text, 'croisieres',       'Cruises',      '⛵',  2, true, now(), now()),
  (gen_random_uuid()::text, 'nature',           'Nature',       '🥾',  3, true, now(), now()),
  (gen_random_uuid()::text, 'aventure',         'Adventure',    '🪂',  4, true, now(), now()),
  (gen_random_uuid()::text, 'excursions',       'Tours',        '🗺️',  5, true, now(), now()),
  (gen_random_uuid()::text, 'culture',          'Culture',      '🏛️',  6, true, now(), now()),
  (gen_random_uuid()::text, 'gastronomie',      'Food & Drink', '🍹',  7, true, now(), now()),
  (gen_random_uuid()::text, 'bien-etre',        'Wellness',     '💆',  8, true, now(), now()),
  (gen_random_uuid()::text, 'vehicules',        'Véhicules',    '🚗',  9, true, now(), now());

-- Filet de sécurité : toute valeur présente en base que la liste ci-dessus
-- n'anticipe pas (une autre branche Neon, une saisie manuelle). Sans ça,
-- l'étape 4 laisserait un `categoryId` NULL et la migration échouerait sur la
-- contrainte NOT NULL — après avoir déjà tout modifié.
INSERT INTO "categories" ("id", "slug", "label", "position", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  lower(regexp_replace(
    translate(a."category", 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
    '[^a-zA-Z0-9]+', '-', 'g')),
  a."category",
  99,
  true,
  now(),
  now()
FROM (SELECT DISTINCT "category" FROM "activities") a
WHERE NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."label" = a."category");

-- ---------------------------------------------------------------------------
-- 3 & 4. Rattacher les activités, PUIS rendre la colonne obligatoire.
-- ---------------------------------------------------------------------------
ALTER TABLE "activities" ADD COLUMN "categoryId" TEXT;

UPDATE "activities" a
SET "categoryId" = c."id"
FROM "categories" c
WHERE c."label" = a."category";

ALTER TABLE "activities" ALTER COLUMN "categoryId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. L'ancienne colonne n'a plus de raison d'être. La garder ferait deux
--    sources de vérité, qui divergeraient au premier renommage.
-- ---------------------------------------------------------------------------
DROP INDEX "activities_status_region_category_idx";
ALTER TABLE "activities" DROP COLUMN "category";

CREATE INDEX "activities_status_region_categoryId_idx" ON "activities"("status", "region", "categoryId");
CREATE INDEX "activities_categoryId_idx" ON "activities"("categoryId");

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

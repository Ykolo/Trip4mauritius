-- Guides éditoriaux et leur classification.
--
-- Écrite à la main comme la précédente : `prisma migrate dev` réclame un reset
-- de la base à cause de l'écart de checksum préexistant sur `add_categories`.
-- Voir le commentaire de 20260907140000_add_superadmin_role.
--
-- Purement ADDITIVE : deux tables neuves, un type neuf. Aucune colonne
-- existante n'est touchée, donc le code déjà déployé continue de tourner.

CREATE TYPE "GuideStatus" AS ENUM ('draft', 'published');

CREATE TABLE "guide_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guide_categories_slug_key" ON "guide_categories"("slug");
CREATE UNIQUE INDEX "guide_categories_label_key" ON "guide_categories"("label");
CREATE INDEX "guide_categories_active_position_idx" ON "guide_categories"("active", "position");

CREATE TABLE "guides" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "status" "GuideStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guides_slug_key" ON "guides"("slug");
CREATE INDEX "guides_status_categoryId_updatedAt_idx" ON "guides"("status", "categoryId", "updatedAt");

-- RESTRICT et non CASCADE : supprimer une catégorie ne doit jamais emporter les
-- articles qu'elle classe. C'est le même choix que pour les activités — on
-- désactive la catégorie, on ne la supprime pas.
ALTER TABLE "guides" ADD CONSTRAINT "guides_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "guide_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un article sans titre ni contenu n'est pas un brouillon, c'est une ligne
-- vide. La contrainte est écrite ici, à la main : Prisma ne la modélise pas.
ALTER TABLE "guides" ADD CONSTRAINT "guides_title_not_blank"
    CHECK (length(btrim("title")) > 0);

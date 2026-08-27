-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('tourist', 'operator', 'admin');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('draft', 'pending_moderation', 'published', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_payment', 'confirmed', 'expired', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'tourist',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "stripeAccountId" TEXT,
    "payoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "priceHt" DECIMAL(10,2) NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" JSONB NOT NULL DEFAULT '{}',
    "status" "ActivityStatus" NOT NULL DEFAULT 'draft',
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_slots" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "maxSpots" INTEGER NOT NULL,
    "spotsTaken" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "participants" INTEGER NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "depositDue" DECIMAL(10,2) NOT NULL,
    "balanceDueOnSite" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "stripePaymentIntentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_stripe_events" (
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "operators_userId_key" ON "operators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "operators_stripeAccountId_key" ON "operators"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_slug_key" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activities_status_region_category_idx" ON "activities"("status", "region", "category");

-- CreateIndex
CREATE INDEX "activities_operatorId_idx" ON "activities"("operatorId");

-- CreateIndex
CREATE INDEX "activity_slots_activityId_startsAt_idx" ON "activity_slots"("activityId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_slots_activityId_startsAt_key" ON "activity_slots"("activityId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingRef_key" ON "bookings"("bookingRef");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_stripePaymentIntentId_key" ON "bookings"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "bookings_userId_createdAt_idx" ON "bookings"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "bookings_status_expiresAt_idx" ON "bookings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_slots" ADD CONSTRAINT "activity_slots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "activity_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- AJOUTS MANUELS — non exprimables en Prisma. Voir docs/BACKEND-PLAN.md §3.
--
-- Ces contraintes portent des invariants métier au niveau de la base : elles
-- tiennent même si le code applicatif se trompe. `prisma db push` les
-- supprimerait silencieusement — il est interdit sur ce projet.
-- ===========================================================================

-- Rend la survente structurellement impossible, même si une requête oublie
-- un jour sa condition de capacité.
ALTER TABLE "activity_slots"
  ADD CONSTRAINT "activity_slots_max_spots_positive" CHECK ("maxSpots" > 0),
  ADD CONSTRAINT "activity_slots_spots_taken_non_negative" CHECK ("spotsTaken" >= 0),
  ADD CONSTRAINT "activity_slots_capacity" CHECK ("spotsTaken" <= "maxSpots");

-- RULE-001 : le fractionnement acompte/solde doit toujours retomber sur le total.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_participants_positive" CHECK ("participants" > 0),
  ADD CONSTRAINT "bookings_amounts_non_negative" CHECK ("totalPrice" >= 0 AND "depositDue" >= 0 AND "balanceDueOnSite" >= 0),
  ADD CONSTRAINT "bookings_amounts_consistent" CHECK ("depositDue" + "balanceDueOnSite" = "totalPrice");

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_price_non_negative" CHECK ("priceHt" >= 0),
  ADD CONSTRAINT "activities_max_participants_positive" CHECK ("maxParticipants" > 0),
  ADD CONSTRAINT "activities_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5));

-- Séquence pour bookingRef (format MX-2026-000123).
-- Un count()+1 côté application produirait des doublons en concurrence.
CREATE SEQUENCE "booking_ref_seq" START 1;

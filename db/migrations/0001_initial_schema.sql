-- 0001_initial_schema.sql
-- MauriExplore — schéma initial (voir docs/BACKEND-PLAN.md §2)
-- Cible : Neon Postgres, projet trip4mauritius

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('tourist','operator','admin');
CREATE TYPE activity_status AS ENUM ('draft','pending_moderation','published','rejected');
CREATE TYPE booking_status AS ENUM ('pending_payment','confirmed','expired','cancelled','completed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'tourist',
  locale text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  verified boolean NOT NULL DEFAULT false,
  stripe_account_id text UNIQUE,
  payout_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  slug citext NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  region text NOT NULL,
  duration text NOT NULL,
  price_ht numeric(10,2) NOT NULL CHECK (price_ht >= 0),
  max_participants integer NOT NULL CHECK (max_participants > 0),
  languages text[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  included text[] NOT NULL DEFAULT '{}',
  excluded text[] NOT NULL DEFAULT '{}',
  -- clés attendues par le front : fr | en | de | es | ru
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  status activity_status NOT NULL DEFAULT 'draft',
  rating numeric(2,1) CHECK (rating >= 0 AND rating <= 5),
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- On stocke spots_taken (compteur croissant), jamais spotsLeft.
-- La contrainte de capacité rend la survente structurellement impossible.
CREATE TABLE activity_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  max_spots integer NOT NULL CHECK (max_spots > 0),
  spots_taken integer NOT NULL DEFAULT 0 CHECK (spots_taken >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_slots_capacity CHECK (spots_taken <= max_spots),
  CONSTRAINT activity_slots_unique_start UNIQUE (activity_id, starts_at)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slot_id uuid NOT NULL REFERENCES activity_slots(id) ON DELETE RESTRICT,
  participants integer NOT NULL CHECK (participants > 0),
  total_price numeric(10,2) NOT NULL CHECK (total_price >= 0),
  deposit_due numeric(10,2) NOT NULL CHECK (deposit_due >= 0),
  balance_due_on_site numeric(10,2) NOT NULL CHECK (balance_due_on_site >= 0),
  status booking_status NOT NULL DEFAULT 'pending_payment',
  stripe_payment_intent_id text UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- RULE-001 : le fractionnement acompte/solde doit toujours retomber sur le total
  CONSTRAINT bookings_amounts_consistent CHECK (deposit_due + balance_due_on_site = total_price)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotence des webhooks Stripe (ADR-001) : sans cette table, un rejeu
-- d'événement double-confirme une réservation.
CREATE TABLE processed_stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activities_filters_idx ON activities (status, region, category);
CREATE INDEX activity_slots_activity_start_idx ON activity_slots (activity_id, starts_at);
CREATE INDEX bookings_user_created_idx ON bookings (user_id, created_at DESC);
CREATE INDEX bookings_expiry_idx ON bookings (status, expires_at);

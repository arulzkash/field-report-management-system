-- Field Report Management System
-- Generated from the ordered Prisma migrations; do not edit independently.
-- Apply to an EMPTY database instead of prisma migrate deploy, never after it.
-- Contains structure and constraints only; demo data is seeded separately.
-- Prisma migration bookkeeping is intentionally excluded.

BEGIN;

-- Migration: 20261014090000_create_users_and_sessions
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'pelapor', 'approver');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(60) NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep canonical emails and nonblank names valid even outside application code.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check"
    CHECK ("email" = lower("email") AND length(trim("email")) > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_name_nonblank_check"
    CHECK (length(trim("name")) > 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_format_check"
    CHECK ("token_hash" ~ '^[a-f0-9]{64}$');

-- Migration: 20261015010000_create_reports
CREATE TYPE "report_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'pending',
    "reporter_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reports_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "reports_description_not_blank" CHECK (length(btrim("description")) > 0),
    CONSTRAINT "reports_version_positive" CHECK ("version" > 0)
);

CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at");

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey"
FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migration: 20261015020000_create_approval_history
CREATE TABLE "approval_history" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "from_status" "report_status" NOT NULL,
    "to_status" "report_status" NOT NULL,
    "report_version" INTEGER NOT NULL,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_history_decision_status" CHECK ("to_status" IN ('approved', 'rejected')),
    CONSTRAINT "approval_history_status_changed" CHECK ("from_status" <> "to_status"),
    CONSTRAINT "approval_history_version_valid" CHECK ("report_version" > 1)
);

CREATE UNIQUE INDEX "approval_history_report_id_report_version_key"
ON "approval_history"("report_id", "report_version");

ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_report_id_fkey"
FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approver_id_fkey"
FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

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

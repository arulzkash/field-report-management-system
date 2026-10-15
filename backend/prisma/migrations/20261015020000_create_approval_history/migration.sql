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

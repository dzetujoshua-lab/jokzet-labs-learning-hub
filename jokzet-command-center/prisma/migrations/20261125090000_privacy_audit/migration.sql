-- Additive: a new audit table. Holds no personal data and has no foreign keys.
CREATE TYPE "PrivacyEventKind" AS ENUM ('EXPORT_DOWNLOADED', 'ACCOUNT_DELETED');
CREATE TYPE "PrivacyEventChannel" AS ENUM ('SELF_SERVICE', 'OWNER_REQUEST');

CREATE TABLE "PrivacyEvent" (
    "id" TEXT NOT NULL,
    "kind" "PrivacyEventKind" NOT NULL,
    "channel" "PrivacyEventChannel" NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyEvent_kind_occurredAt_idx" ON "PrivacyEvent"("kind", "occurredAt");
CREATE INDEX "PrivacyEvent_subjectRef_idx" ON "PrivacyEvent"("subjectRef");

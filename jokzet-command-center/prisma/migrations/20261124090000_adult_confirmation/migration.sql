-- Additive and nullable: existing rows stay NULL ("never asked"); nothing is rewritten or dropped.
ALTER TABLE "Profile" ADD COLUMN "adultConfirmedAt" TIMESTAMP(3);

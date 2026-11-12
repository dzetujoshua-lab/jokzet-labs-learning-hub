-- CreateEnum
CREATE TYPE "DailyMissionStatus" AS ENUM ('SCHEDULED', 'STARTED', 'AWAITING_ASSESSMENT', 'COMPLETED', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DUE', 'ADVANCE', 'TEST', 'MISSED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'BROWSER', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "instanceId" TEXT,
ADD COLUMN     "kind" "NotificationKind" NOT NULL DEFAULT 'DUE',
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScheduleConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "defaultStartTime" TEXT NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rawConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMissionTemplate" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "agenda" JSONB NOT NULL,
    "evidenceTypes" TEXT[],
    "notificationTitle" TEXT NOT NULL,

    CONSTRAINT "WeeklyMissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMissionInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "status" "DailyMissionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMissionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCompletionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "fromStatus" "DailyMissionStatus" NOT NULL,
    "toStatus" "DailyMissionStatus" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionCompletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "advanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advanceMinutes" INTEGER NOT NULL DEFAULT 15,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "browserEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleConfig_userId_isActive_idx" ON "ScheduleConfig"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleConfig_userId_packageId_key" ON "ScheduleConfig"("userId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMissionTemplate_scheduleId_key_key" ON "WeeklyMissionTemplate"("scheduleId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMissionTemplate_scheduleId_dayOfWeek_key" ON "WeeklyMissionTemplate"("scheduleId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DailyMissionInstance_userId_date_idx" ON "DailyMissionInstance"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyMissionInstance_userId_status_idx" ON "DailyMissionInstance"("userId", "status");

-- CreateIndex
CREATE INDEX "DailyMissionInstance_startAt_idx" ON "DailyMissionInstance"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMissionInstance_userId_templateId_date_key" ON "DailyMissionInstance"("userId", "templateId", "date");

-- CreateIndex
CREATE INDEX "MissionCompletionRecord_userId_occurredAt_idx" ON "MissionCompletionRecord"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "MissionCompletionRecord_instanceId_idx" ON "MissionCompletionRecord"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSettings_userId_key" ON "ReminderSettings"("userId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "DailyMissionInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleConfig" ADD CONSTRAINT "ScheduleConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMissionTemplate" ADD CONSTRAINT "WeeklyMissionTemplate_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ScheduleConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMissionInstance" ADD CONSTRAINT "DailyMissionInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMissionInstance" ADD CONSTRAINT "DailyMissionInstance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ScheduleConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMissionInstance" ADD CONSTRAINT "DailyMissionInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeeklyMissionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletionRecord" ADD CONSTRAINT "MissionCompletionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletionRecord" ADD CONSTRAINT "MissionCompletionRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "DailyMissionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSettings" ADD CONSTRAINT "ReminderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Email campaign delivery, consent, suppression, and recipient state.
-- Review and apply through the normal release migration process; this file is not executed automatically.

ALTER TABLE `Lead`
  ADD COLUMN `widgetVisitorId` VARCHAR(191) NULL,
  ADD COLUMN `marketingConsent` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `consentAt` DATETIME(3) NULL,
  ADD COLUMN `consentSource` VARCHAR(191) NULL,
  ADD COLUMN `metadata` JSON NOT NULL DEFAULT ('{}');

CREATE UNIQUE INDEX `Lead_workspaceId_widgetVisitorId_key`
  ON `Lead`(`workspaceId`, `widgetVisitorId`);
CREATE INDEX `Lead_workspaceId_marketingConsent_email_idx`
  ON `Lead`(`workspaceId`, `marketingConsent`, `email`);

ALTER TABLE `Campaign`
  ADD COLUMN `channel` VARCHAR(191) NOT NULL DEFAULT 'zalo',
  ADD COLUMN `subject` VARCHAR(240) NOT NULL DEFAULT '',
  ADD COLUMN `emailHtml` LONGTEXT NULL,
  ADD COLUMN `emailText` LONGTEXT NULL,
  ADD COLUMN `emailAccountId` VARCHAR(191) NULL;

CREATE INDEX `Campaign_workspaceId_channel_status_idx`
  ON `Campaign`(`workspaceId`, `channel`, `status`);
CREATE INDEX `Campaign_emailAccountId_idx`
  ON `Campaign`(`emailAccountId`);
ALTER TABLE `Campaign`
  ADD CONSTRAINT `Campaign_emailAccountId_fkey`
  FOREIGN KEY (`emailAccountId`) REFERENCES `EmailAccount`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `CampaignRecipient` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NULL,
  `channel` VARCHAR(191) NOT NULL,
  `recipient` VARCHAR(320) NOT NULL,
  `normalizedRecipient` VARCHAR(320) NOT NULL,
  `displayName` VARCHAR(120) NOT NULL DEFAULT '',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 3,
  `idempotencyKey` VARCHAR(64) NOT NULL,
  `unsubscribeToken` VARCHAR(64) NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `lastError` TEXT NULL,
  `nextAttemptAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CampaignRecipient_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `CampaignRecipient_unsubscribeToken_key`(`unsubscribeToken`),
  UNIQUE INDEX `CampaignRecipient_campaignId_normalizedRecipient_key`(`campaignId`, `normalizedRecipient`),
  INDEX `CampaignRecipient_campaignId_status_nextAttemptAt_idx`(`campaignId`, `status`, `nextAttemptAt`),
  INDEX `CampaignRecipient_workspaceId_normalizedRecipient_idx`(`workspaceId`, `normalizedRecipient`),
  INDEX `CampaignRecipient_leadId_idx`(`leadId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CampaignRecipient`
  ADD CONSTRAINT `CampaignRecipient_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CampaignRecipient_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CampaignRecipient_leadId_fkey`
  FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `EmailSuppression` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `reason` VARCHAR(191) NOT NULL DEFAULT 'unsubscribed',
  `sourceCampaignId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EmailSuppression_workspaceId_email_key`(`workspaceId`, `email`),
  INDEX `EmailSuppression_workspaceId_reason_idx`(`workspaceId`, `reason`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmailSuppression`
  ADD CONSTRAINT `EmailSuppression_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

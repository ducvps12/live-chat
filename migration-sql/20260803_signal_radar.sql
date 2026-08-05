-- Workspace website-change monitoring and per-tenant Telegram alerts.
CREATE TABLE IF NOT EXISTS `SignalMonitor` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `createdById` varchar(191) NULL,
  `name` varchar(191) NOT NULL,
  `url` text NOT NULL,
  `intervalMinutes` int NOT NULL DEFAULT 360,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `lastCheckedAt` datetime(3) NULL,
  `nextCheckAt` datetime(3) NULL,
  `lastChangedAt` datetime(3) NULL,
  `lastContentHash` varchar(191) NOT NULL DEFAULT '',
  `lastHttpStatus` int NULL,
  `lastError` varchar(500) NULL,
  `consecutiveErrors` int NOT NULL DEFAULT 0,
  `notifyTelegram` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `SignalMonitor_workspaceId_isActive_idx` (`workspaceId`, `isActive`),
  KEY `SignalMonitor_isActive_nextCheckAt_idx` (`isActive`, `nextCheckAt`),
  KEY `SignalMonitor_createdById_idx` (`createdById`),
  CONSTRAINT `SignalMonitor_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE,
  CONSTRAINT `SignalMonitor_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SignalSnapshot` (
  `id` varchar(191) NOT NULL,
  `monitorId` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `contentHash` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL DEFAULT '',
  `excerpt` text NULL,
  `diffSummary` text NULL,
  `changed` tinyint(1) NOT NULL DEFAULT 0,
  `httpStatus` int NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `SignalSnapshot_monitorId_createdAt_idx` (`monitorId`, `createdAt`),
  KEY `SignalSnapshot_workspaceId_createdAt_idx` (`workspaceId`, `createdAt`),
  CONSTRAINT `SignalSnapshot_monitorId_fkey` FOREIGN KEY (`monitorId`) REFERENCES `SignalMonitor` (`id`) ON DELETE CASCADE,
  CONSTRAINT `SignalSnapshot_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SignalAlertSetting` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `telegramEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `telegramBotTokenEncrypted` text NULL,
  `telegramChatId` varchar(191) NOT NULL DEFAULT '',
  `notifyOnChange` tinyint(1) NOT NULL DEFAULT 1,
  `notifyOnError` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SignalAlertSetting_workspaceId_key` (`workspaceId`),
  CONSTRAINT `SignalAlertSetting_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

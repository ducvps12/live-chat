-- Phase 1: Public AI API projects, hashed keys and monthly usage.
-- Run once against the production MySQL database before deploying the API routes.
CREATE TABLE IF NOT EXISTS `ApiProject` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `createdById` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `monthlyRequestLimit` int NOT NULL DEFAULT 100,
  `rateLimitPerMinute` int NOT NULL DEFAULT 10,
  `concurrencyLimit` int NOT NULL DEFAULT 1,
  `allowedModels` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ApiProject_workspaceId_isActive_idx` (`workspaceId`, `isActive`),
  KEY `ApiProject_createdById_idx` (`createdById`),
  CONSTRAINT `ApiProject_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ApiProject_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ApiKey` (
  `id` varchar(191) NOT NULL,
  `projectId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `prefix` varchar(191) NOT NULL,
  `secretHash` varchar(191) NOT NULL,
  `scopes` json NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `lastUsedAt` datetime(3) NULL,
  `expiresAt` datetime(3) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` datetime(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ApiKey_secretHash_key` (`secretHash`),
  KEY `ApiKey_projectId_isActive_idx` (`projectId`, `isActive`),
  KEY `ApiKey_prefix_idx` (`prefix`),
  CONSTRAINT `ApiKey_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ApiProject` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ApiUsage` (
  `id` varchar(191) NOT NULL,
  `projectId` varchar(191) NOT NULL,
  `periodKey` varchar(191) NOT NULL,
  `requestCount` int NOT NULL DEFAULT 0,
  `inputChars` int NOT NULL DEFAULT 0,
  `outputChars` int NOT NULL DEFAULT 0,
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ApiUsage_projectId_periodKey_key` (`projectId`, `periodKey`),
  KEY `ApiUsage_periodKey_idx` (`periodKey`),
  CONSTRAINT `ApiUsage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ApiProject` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AutomationWorkflow` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `createdById` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 0,
  `triggerType` varchar(191) NOT NULL DEFAULT 'conversation_created',
  `actionType` varchar(191) NOT NULL DEFAULT 'draft_reply',
  `approvalMode` varchar(191) NOT NULL DEFAULT 'required',
  `config` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `AutomationWorkflow_workspaceId_isActive_idx` (`workspaceId`,`isActive`),
  KEY `AutomationWorkflow_createdById_idx` (`createdById`),
  CONSTRAINT `AutomationWorkflow_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AutomationWorkflow_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `AutomationRun` (
  `id` varchar(191) NOT NULL,
  `workflowId` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `eventId` varchar(191) NOT NULL,
  `conversationId` varchar(191) DEFAULT NULL,
  `actionType` varchar(191) NOT NULL,
  `status` varchar(64) NOT NULL DEFAULT 'queued',
  `summary` varchar(500) NOT NULL DEFAULT '',
  `output` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AutomationRun_workflowId_eventId_key` (`workflowId`,`eventId`),
  KEY `AutomationRun_workspaceId_createdAt_idx` (`workspaceId`,`createdAt`),
  KEY `AutomationRun_conversationId_createdAt_idx` (`conversationId`,`createdAt`)
);

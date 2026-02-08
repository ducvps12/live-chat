-- Audit Logs Table for Admin Panel
-- Run this script to create the AuditLogs table

USE [live_chat_nemark]
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[AuditLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [audit].[AuditLogs](
        [LogKey] [bigint] IDENTITY(1,1) NOT NULL,
        [LogId] [uniqueidentifier] NOT NULL DEFAULT NEWID(),
        [Action] [nvarchar](50) NOT NULL,           -- login, logout, create, update, delete, ban, unban, etc.
        [EntityType] [nvarchar](50) NULL,           -- user, workspace, widget, conversation, etc.
        [EntityId] [nvarchar](100) NULL,            -- ID of affected entity
        [ActorKey] [bigint] NULL,                   -- UserKey who performed action
        [ActorEmail] [nvarchar](255) NULL,          -- Email of actor
        [IpAddress] [nvarchar](45) NULL,            -- IP address
        [UserAgent] [nvarchar](500) NULL,           -- Browser/client info
        [Details] [nvarchar](max) NULL,             -- JSON with extra details
        [Status] [nvarchar](20) NOT NULL DEFAULT 'success', -- success, failed, warning
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED ([LogKey] ASC)
    ) ON [PRIMARY]

    -- Index for faster queries
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_CreatedAt] ON [audit].[AuditLogs]([CreatedAt] DESC)
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_Action] ON [audit].[AuditLogs]([Action])
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_ActorKey] ON [audit].[AuditLogs]([ActorKey])
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_EntityType] ON [audit].[AuditLogs]([EntityType])
    
    PRINT 'AuditLogs table created successfully'
END
ELSE
BEGIN
    PRINT 'AuditLogs table already exists'
END
GO

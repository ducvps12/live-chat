-- =====================================================
-- Webhook Integration Schema
-- Created: 2026-01-31
-- =====================================================

USE [live_chat_nemark];
GO

-- Create channels schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'channels')
BEGIN
    EXEC('CREATE SCHEMA [channels]');
END
GO

-- Webhooks table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Webhooks' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[Webhooks](
        [WebhookKey] [bigint] IDENTITY(1,1) NOT NULL,
        [WebhookId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [WorkspaceKey] [bigint] NOT NULL,
        
        -- Webhook configuration
        [Name] [nvarchar](100) NOT NULL,
        [Url] [nvarchar](500) NOT NULL,
        [Secret] [nvarchar](100) NULL,  -- For HMAC-SHA256 signature
        [Events] [nvarchar](max) NOT NULL,  -- JSON array of subscribed events
        
        -- Status: 1=Active, 2=Paused, 3=Failed (auto-disabled after too many failures)
        [Status] [tinyint] NOT NULL DEFAULT 1,
        
        -- Tracking
        [LastTriggeredAt] [datetime2](3) NULL,
        [SuccessCount] [int] NOT NULL DEFAULT 0,
        [FailCount] [int] NOT NULL DEFAULT 0,
        [LastError] [nvarchar](500) NULL,
        
        -- Timestamps
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_Webhooks] PRIMARY KEY CLUSTERED ([WebhookKey]),
        CONSTRAINT [UQ_Webhooks_WebhookId] UNIQUE ([WebhookId]),
        CONSTRAINT [FK_Webhooks_Workspace] FOREIGN KEY ([WorkspaceKey]) 
            REFERENCES [iam].[Workspaces]([WorkspaceKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_Webhooks_WorkspaceKey] ON [channels].[Webhooks]([WorkspaceKey]);
    CREATE INDEX [IX_Webhooks_Status] ON [channels].[Webhooks]([Status]);
    
    PRINT 'Created table channels.Webhooks';
END
ELSE
BEGIN
    PRINT 'Table channels.Webhooks already exists';
END
GO

-- Webhook Logs table for debugging and analytics
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebhookLogs' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[WebhookLogs](
        [LogKey] [bigint] IDENTITY(1,1) NOT NULL,
        [WebhookKey] [bigint] NOT NULL,
        
        -- Event info
        [EventType] [nvarchar](50) NOT NULL,
        [Payload] [nvarchar](max) NULL,
        
        -- Response info
        [ResponseStatus] [int] NULL,
        [ResponseBody] [nvarchar](max) NULL,
        [ResponseTime] [int] NULL,  -- milliseconds
        
        -- Error info
        [Success] [bit] NOT NULL DEFAULT 1,
        [Error] [nvarchar](500) NULL,
        
        -- Timestamp
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_WebhookLogs] PRIMARY KEY CLUSTERED ([LogKey]),
        CONSTRAINT [FK_WebhookLogs_Webhook] FOREIGN KEY ([WebhookKey]) 
            REFERENCES [channels].[Webhooks]([WebhookKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_WebhookLogs_WebhookKey] ON [channels].[WebhookLogs]([WebhookKey]);
    CREATE INDEX [IX_WebhookLogs_CreatedAt] ON [channels].[WebhookLogs]([CreatedAt] DESC);
    
    PRINT 'Created table channels.WebhookLogs';
END
ELSE
BEGIN
    PRINT 'Table channels.WebhookLogs already exists';
END
GO

PRINT 'Webhook integration schema setup complete';
GO

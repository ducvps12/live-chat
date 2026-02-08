-- =====================================================
-- Instagram Integration Schema
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

-- Instagram Accounts table (linked via Facebook Pages)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InstagramAccounts' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[InstagramAccounts](
        [AccountKey] [bigint] IDENTITY(1,1) NOT NULL,
        [AccountId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [WorkspaceKey] [bigint] NOT NULL,
        
        -- Instagram data
        [InstagramBusinessId] [nvarchar](50) NOT NULL,     -- Instagram Business Account ID
        [InstagramUsername] [nvarchar](100) NOT NULL,       -- @username
        [InstagramName] [nvarchar](255) NULL,               -- Display name
        [InstagramAvatar] [nvarchar](500) NULL,             -- Profile picture URL
        
        -- Linked Facebook Page (required for Instagram API)
        [LinkedFacebookPageId] [nvarchar](50) NOT NULL,
        [LinkedFacebookPageName] [nvarchar](255) NULL,
        [PageAccessToken] [nvarchar](max) NOT NULL,         -- Long-lived page token
        
        -- Status: 1=Active, 2=Disconnected, 3=TokenExpired, 4=Error
        [Status] [tinyint] NOT NULL DEFAULT 1,
        [LastSyncAt] [datetime2](3) NULL,
        [ErrorMessage] [nvarchar](500) NULL,
        
        -- Settings (JSON): autoReplyDM, welcomeMessage, etc.
        [Settings] [nvarchar](max) NULL,
        
        -- Timestamps
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_InstagramAccounts] PRIMARY KEY CLUSTERED ([AccountKey]),
        CONSTRAINT [UQ_InstagramAccounts_AccountId] UNIQUE ([AccountId]),
        CONSTRAINT [UQ_InstagramAccounts_Workspace_IG] UNIQUE ([WorkspaceKey], [InstagramBusinessId]),
        CONSTRAINT [FK_InstagramAccounts_Workspace] FOREIGN KEY ([WorkspaceKey]) 
            REFERENCES [iam].[Workspaces]([WorkspaceKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_InstagramAccounts_InstagramBusinessId] ON [channels].[InstagramAccounts]([InstagramBusinessId]);
    CREATE INDEX [IX_InstagramAccounts_Status] ON [channels].[InstagramAccounts]([Status]);
    
    PRINT 'Created table channels.InstagramAccounts';
END
ELSE
BEGIN
    PRINT 'Table channels.InstagramAccounts already exists';
END
GO

PRINT 'Instagram integration schema setup complete';
GO

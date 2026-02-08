-- =====================================================
-- Facebook Pages Integration Schema
-- Created: 2026-01-29
-- =====================================================

USE [live_chat_nemark];
GO

-- Create channels schema for social integrations
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'channels')
BEGIN
    EXEC('CREATE SCHEMA [channels]');
END
GO

-- Facebook Pages table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FacebookPages' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[FacebookPages](
        [PageKey] [bigint] IDENTITY(1,1) NOT NULL,
        [PageId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [WorkspaceKey] [bigint] NOT NULL,
        
        -- Facebook data
        [FacebookPageId] [nvarchar](50) NOT NULL,      -- FB's page ID
        [FacebookPageName] [nvarchar](255) NOT NULL,   -- Page name
        [FacebookPageAvatar] [nvarchar](500) NULL,     -- Avatar URL
        [PageAccessToken] [nvarchar](max) NOT NULL,    -- Encrypted token
        
        -- Status: 1=Active, 2=Disconnected, 3=TokenExpired, 4=Error
        [Status] [tinyint] NOT NULL DEFAULT 1,
        [LastSyncAt] [datetime2](3) NULL,
        [ErrorMessage] [nvarchar](500) NULL,
        
        -- Settings (JSON): autoReplyComment, etc.
        [Settings] [nvarchar](max) NULL,
        
        -- Timestamps
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_FacebookPages] PRIMARY KEY CLUSTERED ([PageKey]),
        CONSTRAINT [UQ_FacebookPages_PageId] UNIQUE ([PageId]),
        CONSTRAINT [UQ_FacebookPages_Workspace_FBPage] UNIQUE ([WorkspaceKey], [FacebookPageId]),
        CONSTRAINT [FK_FacebookPages_Workspace] FOREIGN KEY ([WorkspaceKey]) 
            REFERENCES [iam].[Workspaces]([WorkspaceKey]) ON DELETE CASCADE
    );

    -- Index for quick lookup by FB Page ID
    CREATE INDEX [IX_FacebookPages_FacebookPageId] ON [channels].[FacebookPages]([FacebookPageId]);
    
    PRINT 'Created table channels.FacebookPages';
END
ELSE
BEGIN
    PRINT 'Table channels.FacebookPages already exists';
END
GO

-- Facebook Conversations table (for linking FB conversations to our system)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FacebookConversations' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[FacebookConversations](
        [ConversationKey] [bigint] IDENTITY(1,1) NOT NULL,
        [ConversationId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [PageKey] [bigint] NOT NULL,
        
        -- Facebook data
        [FacebookConversationId] [nvarchar](100) NOT NULL,  -- FB's conversation/thread ID
        [FacebookSenderId] [nvarchar](50) NOT NULL,         -- FB user's PSID
        [SenderName] [nvarchar](255) NULL,
        [SenderAvatar] [nvarchar](500) NULL,
        
        -- Status
        [Status] [tinyint] NOT NULL DEFAULT 1,  -- 1=Open, 2=Closed
        [AssignedToUserKey] [bigint] NULL,
        
        -- Message tracking
        [LastMessageAt] [datetime2](3) NULL,
        [LastMessagePreview] [nvarchar](500) NULL,
        [UnreadCount] [int] NOT NULL DEFAULT 0,
        
        -- Timestamps
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_FacebookConversations] PRIMARY KEY CLUSTERED ([ConversationKey]),
        CONSTRAINT [UQ_FacebookConversations_Id] UNIQUE ([ConversationId]),
        CONSTRAINT [UQ_FacebookConversations_Page_Sender] UNIQUE ([PageKey], [FacebookSenderId]),
        CONSTRAINT [FK_FacebookConversations_Page] FOREIGN KEY ([PageKey]) 
            REFERENCES [channels].[FacebookPages]([PageKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_FacebookConversations_PageKey] ON [channels].[FacebookConversations]([PageKey]);
    CREATE INDEX [IX_FacebookConversations_Status] ON [channels].[FacebookConversations]([Status]);
    
    PRINT 'Created table channels.FacebookConversations';
END
GO

PRINT 'Facebook integration schema setup complete';
GO

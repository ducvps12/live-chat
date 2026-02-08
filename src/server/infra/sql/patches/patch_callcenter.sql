-- =====================================================
-- Call Center (VoIP) Integration Schema
-- Created: 2026-01-31
-- Provider: Twilio
-- =====================================================

USE [live_chat_nemark];
GO

-- Create channels schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'channels')
BEGIN
    EXEC('CREATE SCHEMA [channels]');
END
GO

-- Phone Numbers table (provisioned from Twilio)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CallCenterNumbers' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[CallCenterNumbers](
        [NumberKey] [bigint] IDENTITY(1,1) NOT NULL,
        [NumberId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [WorkspaceKey] [bigint] NOT NULL,
        
        -- Phone number info
        [PhoneNumber] [nvarchar](20) NOT NULL,          -- E.164 format: +84xxxxxxxxx
        [FriendlyName] [nvarchar](100) NULL,            -- Display name
        [Provider] [nvarchar](50) NOT NULL DEFAULT 'twilio',
        [ProviderNumberSid] [nvarchar](100) NOT NULL,   -- Twilio SID
        
        -- Capabilities (JSON): voice, sms, mms, fax
        [Capabilities] [nvarchar](max) NULL,
        
        -- Status: 1=Active, 2=Suspended, 3=Released
        [Status] [tinyint] NOT NULL DEFAULT 1,
        
        -- Settings (JSON): voiceUrl, smsUrl, welcomeMessage, etc.
        [Settings] [nvarchar](max) NULL,
        
        -- Timestamps
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_CallCenterNumbers] PRIMARY KEY CLUSTERED ([NumberKey]),
        CONSTRAINT [UQ_CallCenterNumbers_NumberId] UNIQUE ([NumberId]),
        CONSTRAINT [UQ_CallCenterNumbers_PhoneNumber] UNIQUE ([PhoneNumber]),
        CONSTRAINT [FK_CallCenterNumbers_Workspace] FOREIGN KEY ([WorkspaceKey]) 
            REFERENCES [iam].[Workspaces]([WorkspaceKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_CallCenterNumbers_WorkspaceKey] ON [channels].[CallCenterNumbers]([WorkspaceKey]);
    CREATE INDEX [IX_CallCenterNumbers_Status] ON [channels].[CallCenterNumbers]([Status]);
    
    PRINT 'Created table channels.CallCenterNumbers';
END
GO

-- Calls table (call history/logs)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Calls' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[Calls](
        [CallKey] [bigint] IDENTITY(1,1) NOT NULL,
        [CallId] [uniqueidentifier] NOT NULL DEFAULT NEWSEQUENTIALID(),
        [WorkspaceKey] [bigint] NOT NULL,
        [NumberKey] [bigint] NOT NULL,
        
        -- Twilio identifiers
        [ProviderCallSid] [nvarchar](100) NULL,         -- Twilio Call SID
        
        -- Call details
        [Direction] [nvarchar](10) NOT NULL,            -- inbound, outbound
        [FromNumber] [nvarchar](20) NOT NULL,
        [ToNumber] [nvarchar](20) NOT NULL,
        [CallerName] [nvarchar](255) NULL,              -- Caller ID name if available
        
        -- Status: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
        [Status] [nvarchar](20) NOT NULL DEFAULT 'queued',
        
        -- Call metrics
        [Duration] [int] NULL,                          -- seconds
        [QueueTime] [int] NULL,                         -- seconds waiting
        
        -- Recording
        [RecordingUrl] [nvarchar](500) NULL,
        [RecordingSid] [nvarchar](100) NULL,
        [TranscriptText] [nvarchar](max) NULL,
        
        -- Assignment
        [AssignedToUserKey] [bigint] NULL,
        [ConversationKey] [bigint] NULL,                -- Link to chat if exists
        
        -- Timestamps
        [StartedAt] [datetime2](3) NULL,
        [AnsweredAt] [datetime2](3) NULL,
        [EndedAt] [datetime2](3) NULL,
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_Calls] PRIMARY KEY CLUSTERED ([CallKey]),
        CONSTRAINT [UQ_Calls_CallId] UNIQUE ([CallId]),
        CONSTRAINT [FK_Calls_Number] FOREIGN KEY ([NumberKey]) 
            REFERENCES [channels].[CallCenterNumbers]([NumberKey]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_Calls_WorkspaceKey] ON [channels].[Calls]([WorkspaceKey]);
    CREATE INDEX [IX_Calls_NumberKey] ON [channels].[Calls]([NumberKey]);
    CREATE INDEX [IX_Calls_Status] ON [channels].[Calls]([Status]);
    CREATE INDEX [IX_Calls_CreatedAt] ON [channels].[Calls]([CreatedAt] DESC);
    CREATE INDEX [IX_Calls_ProviderCallSid] ON [channels].[Calls]([ProviderCallSid]);
    
    PRINT 'Created table channels.Calls';
END
GO

-- Call Center Settings per workspace
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CallCenterSettings' AND schema_id = SCHEMA_ID('channels'))
BEGIN
    CREATE TABLE [channels].[CallCenterSettings](
        [SettingKey] [bigint] IDENTITY(1,1) NOT NULL,
        [WorkspaceKey] [bigint] NOT NULL,
        
        -- Twilio credentials (encrypted in production)
        [TwilioAccountSid] [nvarchar](100) NULL,
        [TwilioAuthToken] [nvarchar](100) NULL,
        [TwilioApiKeySid] [nvarchar](100) NULL,
        [TwilioApiKeySecret] [nvarchar](100) NULL,
        
        -- General settings
        [RecordCalls] [bit] NOT NULL DEFAULT 0,
        [TranscribeCalls] [bit] NOT NULL DEFAULT 0,
        [MaxQueueTime] [int] NOT NULL DEFAULT 300,      -- 5 minutes default
        [WelcomeMessage] [nvarchar](500) NULL,
        [HoldMusicUrl] [nvarchar](500) NULL,
        
        -- Working hours (JSON): { "mon": { "start": "09:00", "end": "18:00" }, ... }
        [WorkingHours] [nvarchar](max) NULL,
        [OutOfHoursMessage] [nvarchar](500) NULL,
        
        [CreatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] [datetime2](3) NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT [PK_CallCenterSettings] PRIMARY KEY CLUSTERED ([SettingKey]),
        CONSTRAINT [UQ_CallCenterSettings_Workspace] UNIQUE ([WorkspaceKey]),
        CONSTRAINT [FK_CallCenterSettings_Workspace] FOREIGN KEY ([WorkspaceKey]) 
            REFERENCES [iam].[Workspaces]([WorkspaceKey]) ON DELETE CASCADE
    );
    
    PRINT 'Created table channels.CallCenterSettings';
END
GO

PRINT 'Call Center integration schema setup complete';
GO

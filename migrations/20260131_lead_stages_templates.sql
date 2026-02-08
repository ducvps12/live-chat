-- Migration: Add Lead Stages, Tags, and Message Templates
-- Purpose: CRM enhancement for Zalo integration
-- Date: 2026-01-31

-- =============================================
-- PART 1: Lead Stage fields on Conversations
-- =============================================

-- Add LeadStage column
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'LeadStage'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD LeadStage NVARCHAR(50) DEFAULT 'potential';
    PRINT 'Added LeadStage column';
END

-- Add LeadScore column
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'LeadScore'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD LeadScore INT DEFAULT 0;
    PRINT 'Added LeadScore column';
END

-- Add Tags column
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'Tags'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD Tags NVARCHAR(500) NULL;
    PRINT 'Added Tags column';
END

-- Add LastContactedAt column
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'LastContactedAt'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD LastContactedAt DATETIME2 NULL;
    PRINT 'Added LastContactedAt column';
END

-- Add NextFollowUpAt column
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'NextFollowUpAt'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD NextFollowUpAt DATETIME2 NULL;
    PRINT 'Added NextFollowUpAt column';
END

-- =============================================
-- PART 2: Lead Stage History Table
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.LeadStageHistory') AND type = 'U')
BEGIN
    CREATE TABLE iam.LeadStageHistory (
        HistoryKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        ConversationKey BIGINT NOT NULL,
        FromStage NVARCHAR(50),
        ToStage NVARCHAR(50) NOT NULL,
        ChangedByUserKey BIGINT NULL,
        Note NVARCHAR(500) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    
    CREATE INDEX IX_LeadStageHistory_ConversationKey ON iam.LeadStageHistory(ConversationKey);
    PRINT 'Created LeadStageHistory table';
END

-- =============================================
-- PART 3: Message Templates Table
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.MessageTemplates') AND type = 'U')
BEGIN
    CREATE TABLE iam.MessageTemplates (
        TemplateKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        TemplateId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Category NVARCHAR(50) DEFAULT 'general', -- greeting, closing, product, support, general
        Content NVARCHAR(MAX) NOT NULL,
        Shortcut NVARCHAR(20) NULL, -- e.g. /hi, /price
        UsageCount INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedByUserKey BIGINT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    
    CREATE INDEX IX_MessageTemplates_WorkspaceKey ON iam.MessageTemplates(WorkspaceKey);
    CREATE UNIQUE INDEX IX_MessageTemplates_Shortcut ON iam.MessageTemplates(WorkspaceKey, Shortcut) WHERE Shortcut IS NOT NULL;
    PRINT 'Created MessageTemplates table';
END

-- =============================================
-- PART 4: Auto-Reply Rules Table
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.AutoReplyRules') AND type = 'U')
BEGIN
    CREATE TABLE iam.AutoReplyRules (
        RuleKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        RuleId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Keywords NVARCHAR(500) NOT NULL, -- comma-separated keywords
        MatchType NVARCHAR(20) DEFAULT 'contains', -- contains, exact, regex
        ReplyContent NVARCHAR(MAX) NOT NULL,
        Channels NVARCHAR(100) DEFAULT 'all', -- all, zalo, website, facebook
        IsActive BIT DEFAULT 1,
        Priority INT DEFAULT 0,
        TriggerCount INT DEFAULT 0,
        CreatedByUserKey BIGINT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    
    CREATE INDEX IX_AutoReplyRules_WorkspaceKey ON iam.AutoReplyRules(WorkspaceKey);
    PRINT 'Created AutoReplyRules table';
END

-- =============================================
-- PART 5: Conversation Tags Table (Many-to-Many)
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.Tags') AND type = 'U')
BEGIN
    CREATE TABLE iam.Tags (
        TagKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        TagId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        Name NVARCHAR(50) NOT NULL,
        Color NVARCHAR(7) DEFAULT '#3B82F6', -- hex color
        IsSystem BIT DEFAULT 0, -- system-generated vs user-created
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    
    CREATE UNIQUE INDEX IX_Tags_WorkspaceKey_Name ON iam.Tags(WorkspaceKey, Name);
    PRINT 'Created Tags table';
END

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.ConversationTags') AND type = 'U')
BEGIN
    CREATE TABLE iam.ConversationTags (
        ConversationKey BIGINT NOT NULL,
        TagKey BIGINT NOT NULL,
        AddedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        AddedByUserKey BIGINT NULL,
        PRIMARY KEY (ConversationKey, TagKey)
    );
    PRINT 'Created ConversationTags table';
END

-- =============================================
-- PART 6: Insert Default Tags
-- =============================================

-- We'll insert default tags per workspace when needed via application code

GO

PRINT '=== Migration completed successfully ===';

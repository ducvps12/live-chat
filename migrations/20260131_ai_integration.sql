-- ============================================
-- AI Integration Migration
-- Date: 2026-01-31
-- Description: Add AI settings to BotSettings and create usage tracking
-- ============================================

-- PART 1: Add AI columns to BotSettings
-- ============================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('iam.BotSettings') AND name = 'AiEnabled')
BEGIN
    ALTER TABLE iam.BotSettings ADD AiEnabled BIT DEFAULT 0;
    PRINT 'Added AiEnabled column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('iam.BotSettings') AND name = 'AiModel')
BEGIN
    ALTER TABLE iam.BotSettings ADD AiModel NVARCHAR(100) DEFAULT 'gemini-2.5-flash';
    PRINT 'Added AiModel column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('iam.BotSettings') AND name = 'AiSystemPrompt')
BEGIN
    ALTER TABLE iam.BotSettings ADD AiSystemPrompt NVARCHAR(MAX) NULL;
    PRINT 'Added AiSystemPrompt column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('iam.BotSettings') AND name = 'AiMaxTokens')
BEGIN
    ALTER TABLE iam.BotSettings ADD AiMaxTokens INT DEFAULT 500;
    PRINT 'Added AiMaxTokens column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('iam.BotSettings') AND name = 'AiTemperature')
BEGIN
    ALTER TABLE iam.BotSettings ADD AiTemperature DECIMAL(3,2) DEFAULT 0.7;
    PRINT 'Added AiTemperature column';
END

-- PART 2: AI Usage Tracking Table
-- ============================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AiUsage' AND schema_id = SCHEMA_ID('iam'))
BEGIN
    CREATE TABLE iam.AiUsage (
        UsageKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        UsageId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        ConversationId UNIQUEIDENTIFIER NULL,
        Model NVARCHAR(100) NOT NULL,
        PromptTokens INT DEFAULT 0,
        CompletionTokens INT DEFAULT 0,
        TotalTokens INT DEFAULT 0,
        ResponseTimeMs INT DEFAULT 0,
        Success BIT DEFAULT 1,
        ErrorMessage NVARCHAR(500) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_AiUsage_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_AiUsage_Workspace ON iam.AiUsage(WorkspaceKey, CreatedAt DESC);
    CREATE INDEX IX_AiUsage_CreatedAt ON iam.AiUsage(CreatedAt DESC);
    
    PRINT 'Created AiUsage table';
END

-- PART 3: Update default system prompt for existing workspaces
-- ============================================

UPDATE iam.BotSettings 
SET AiSystemPrompt = N'Bạn là trợ lý ảo của Nemark Inbox - nền tảng live chat hỗ trợ khách hàng. Hãy trả lời ngắn gọn, thân thiện và hữu ích. Nếu không biết câu trả lời, hãy đề nghị khách hàng chờ nhân viên hỗ trợ.'
WHERE AiSystemPrompt IS NULL;

PRINT 'AI Integration migration completed successfully';

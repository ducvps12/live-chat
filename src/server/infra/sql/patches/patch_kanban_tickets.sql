-- =============================================
-- Kanban Tickets Table Migration
-- Created: 2026-01-30
-- Description: Table for managing tickets and tasks in Kanban board
-- =============================================

-- Create Tickets table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'iam.Tickets') AND type = 'U')
BEGIN
    CREATE TABLE iam.Tickets (
        TicketKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        TicketId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        ConversationKey BIGINT NULL,
        
        -- Basic Info
        Title NVARCHAR(500) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Type TINYINT NOT NULL DEFAULT 1,  -- 1=Ticket, 2=Task
        
        -- Status (Kanban columns)
        Status TINYINT NOT NULL DEFAULT 1,  -- 1=Mới, 2=Đang xử lý, 3=Chờ phản hồi, 4=Hoàn thành
        Priority TINYINT NOT NULL DEFAULT 2,  -- 1=Low, 2=Medium, 3=High, 4=Critical
        
        -- Assignment
        AssigneeUserKey BIGINT NULL,
        ReporterUserKey BIGINT NOT NULL,
        
        -- Dates
        DueDate DATETIME2 NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
        CompletedAt DATETIME2 NULL,
        
        -- Position for drag-drop ordering within column
        Position INT NOT NULL DEFAULT 0,
        
        -- Foreign Keys
        CONSTRAINT FK_Tickets_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam.Workspaces(WorkspaceKey),
        CONSTRAINT FK_Tickets_Assignee FOREIGN KEY (AssigneeUserKey) REFERENCES iam.Users(UserKey),
        CONSTRAINT FK_Tickets_Reporter FOREIGN KEY (ReporterUserKey) REFERENCES iam.Users(UserKey)
    );
    
    PRINT 'Created iam.Tickets table';
END
GO

-- Create indexes for common queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tickets_Workspace' AND object_id = OBJECT_ID('iam.Tickets'))
BEGIN
    CREATE INDEX IX_Tickets_Workspace ON iam.Tickets(WorkspaceKey);
    PRINT 'Created IX_Tickets_Workspace index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tickets_Status' AND object_id = OBJECT_ID('iam.Tickets'))
BEGIN
    CREATE INDEX IX_Tickets_Status ON iam.Tickets(Status);
    PRINT 'Created IX_Tickets_Status index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tickets_Assignee' AND object_id = OBJECT_ID('iam.Tickets'))
BEGIN
    CREATE INDEX IX_Tickets_Assignee ON iam.Tickets(AssigneeUserKey);
    PRINT 'Created IX_Tickets_Assignee index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tickets_Type' AND object_id = OBJECT_ID('iam.Tickets'))
BEGIN
    CREATE INDEX IX_Tickets_Type ON iam.Tickets(Type);
    PRINT 'Created IX_Tickets_Type index';
END
GO

PRINT 'Kanban tickets migration completed successfully';

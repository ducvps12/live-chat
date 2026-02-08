-- =============================================
-- WhatsApp Business Integration Tables
-- Migration: 2026-01-31
-- =============================================

-- Create channels schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'channels')
BEGIN
    EXEC('CREATE SCHEMA channels');
END
GO

-- WhatsApp Accounts
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'channels.WhatsAppAccounts') AND type = 'U')
BEGIN
    CREATE TABLE channels.WhatsAppAccounts (
        AccountKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        AccountId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        PhoneNumberId NVARCHAR(50) NOT NULL,          -- Meta Phone Number ID
        DisplayNumber NVARCHAR(50),                    -- +84 xxx xxx xxx
        BusinessAccountId NVARCHAR(50),                -- WABA ID
        AccessToken NVARCHAR(512),
        Status INT DEFAULT 1,                          -- 1=Active, 0=Disconnected
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT FK_WhatsApp_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey),
        CONSTRAINT UQ_WhatsApp_PhoneNumberId UNIQUE (PhoneNumberId)
    );

    CREATE INDEX IX_WhatsApp_WorkspaceKey ON channels.WhatsAppAccounts(WorkspaceKey);
    CREATE INDEX IX_WhatsApp_PhoneNumberId ON channels.WhatsAppAccounts(PhoneNumberId);
    
    PRINT 'Created channels.WhatsAppAccounts table';
END
GO

-- =============================================
-- Billing System Tables
-- =============================================

-- Create billing schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'billing')
BEGIN
    EXEC('CREATE SCHEMA billing');
END
GO

-- Subscription Plans (Admin-defined)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.SubscriptionPlans') AND type = 'U')
BEGIN
    CREATE TABLE billing.SubscriptionPlans (
        PlanKey INT IDENTITY(1,1) PRIMARY KEY,
        PlanId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        Name NVARCHAR(100) NOT NULL,                   -- 'Cơ bản', 'Nâng cao', 'Doanh nghiệp'
        Description NVARCHAR(500),
        PriceMonthly DECIMAL(18,2),                    -- VND
        PriceYearly DECIMAL(18,2),                     -- VND
        MaxAgents INT DEFAULT -1,                      -- -1 = Unlimited
        MaxFanpages INT DEFAULT 100,
        MaxZaloPersonal INT DEFAULT 0,
        MaxWhatsApp INT DEFAULT 0,
        MaxInstagram INT DEFAULT 0,
        Features NVARCHAR(MAX),                        -- JSON feature flags
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2
    );
    
    -- Insert default plans
    INSERT INTO billing.SubscriptionPlans (Name, Description, PriceMonthly, PriceYearly, MaxAgents, MaxFanpages, MaxZaloPersonal, Features, SortOrder)
    VALUES 
        (N'Dùng thử', N'Gói dùng thử 14 ngày', 0, 0, 2, 10, 0, '{"bot":true,"ticket":false,"ai":false}', 0),
        (N'Cơ bản', N'Phù hợp để chăm sóc khách hàng', 399000, 3994000, -1, 100, 0, '{"bot":true,"ticket":false,"ai":false}', 1),
        (N'Nâng cao', N'Phù hợp để thúc đẩy doanh số', 799000, 7834000, -1, 1000, 3, '{"bot":true,"ticket":true,"ai":true,"automation":true}', 2),
        (N'Doanh nghiệp', N'Thiết kế riêng cho doanh nghiệp', NULL, NULL, -1, -1, -1, '{"bot":true,"ticket":true,"ai":true,"automation":true,"api":true,"support":true}', 3);
    
    PRINT 'Created billing.SubscriptionPlans table with default plans';
END
GO

-- Workspace Subscriptions
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.WorkspaceSubscriptions') AND type = 'U')
BEGIN
    CREATE TABLE billing.WorkspaceSubscriptions (
        SubscriptionKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        SubscriptionId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        PlanKey INT NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        BillingCycle NVARCHAR(20) DEFAULT 'yearly',    -- 'monthly', 'yearly'
        Status INT DEFAULT 1,                          -- 1=Active, 2=Expired, 3=Cancelled
        AutoRenew BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT FK_Subscription_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey),
        CONSTRAINT FK_Subscription_Plan FOREIGN KEY (PlanKey) 
            REFERENCES billing.SubscriptionPlans(PlanKey)
    );

    CREATE INDEX IX_Subscription_WorkspaceKey ON billing.WorkspaceSubscriptions(WorkspaceKey);
    CREATE INDEX IX_Subscription_Status ON billing.WorkspaceSubscriptions(Status);
    
    PRINT 'Created billing.WorkspaceSubscriptions table';
END
GO

-- Marketing Credits
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.MarketingCredits') AND type = 'U')
BEGIN
    CREATE TABLE billing.MarketingCredits (
        CreditKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        WorkspaceKey BIGINT UNIQUE NOT NULL,
        Balance DECIMAL(18,2) DEFAULT 0,               -- VND balance
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_Credits_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey)
    );
    
    PRINT 'Created billing.MarketingCredits table';
END
GO

-- Credit Transactions
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.CreditTransactions') AND type = 'U')
BEGIN
    CREATE TABLE billing.CreditTransactions (
        TransactionKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        TransactionId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,
        WorkspaceKey BIGINT NOT NULL,
        Type NVARCHAR(20) NOT NULL,                    -- 'deposit', 'usage', 'refund'
        Amount DECIMAL(18,2) NOT NULL,
        Channel NVARCHAR(50),                          -- 'email', 'zalo_zns', 'whatsapp'
        Description NVARCHAR(500),
        ReferenceId NVARCHAR(100),                     -- Campaign ID, etc
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_Transaction_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey)
    );

    CREATE INDEX IX_Transaction_WorkspaceKey ON billing.CreditTransactions(WorkspaceKey);
    CREATE INDEX IX_Transaction_Type ON billing.CreditTransactions(Type);
    CREATE INDEX IX_Transaction_CreatedAt ON billing.CreditTransactions(CreatedAt);
    
    PRINT 'Created billing.CreditTransactions table';
END
GO

-- AI Credits
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.AICredits') AND type = 'U')
BEGIN
    CREATE TABLE billing.AICredits (
        AICreditsKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        WorkspaceKey BIGINT UNIQUE NOT NULL,
        Balance DECIMAL(18,4) DEFAULT 0,               -- Token credits
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_AICredits_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey)
    );
    
    PRINT 'Created billing.AICredits table';
END
GO

-- AI Usage Log
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.AIUsage') AND type = 'U')
BEGIN
    CREATE TABLE billing.AIUsage (
        UsageKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        WorkspaceKey BIGINT NOT NULL,
        Feature NVARCHAR(50),                          -- 'chatbot', 'summarize', 'sentiment'
        TokensUsed INT NOT NULL,
        Cost DECIMAL(18,4),
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_AIUsage_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey)
    );

    CREATE INDEX IX_AIUsage_WorkspaceKey ON billing.AIUsage(WorkspaceKey);
    CREATE INDEX IX_AIUsage_CreatedAt ON billing.AIUsage(CreatedAt);
    
    PRINT 'Created billing.AIUsage table';
END
GO

-- Usage Tracking (Monthly aggregation)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'billing.WorkspaceUsage') AND type = 'U')
BEGIN
    CREATE TABLE billing.WorkspaceUsage (
        UsageKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        WorkspaceKey BIGINT NOT NULL,
        Month DATE NOT NULL,                           -- First day of month
        AgentCount INT DEFAULT 0,
        FanpageCount INT DEFAULT 0,
        ZaloCount INT DEFAULT 0,
        WhatsAppCount INT DEFAULT 0,
        InstagramCount INT DEFAULT 0,
        MessagesSent BIGINT DEFAULT 0,
        MessagesReceived BIGINT DEFAULT 0,
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_Usage_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey),
        CONSTRAINT UQ_Usage_WorkspaceMonth UNIQUE (WorkspaceKey, Month)
    );

    CREATE INDEX IX_Usage_Month ON billing.WorkspaceUsage(Month);
    
    PRINT 'Created billing.WorkspaceUsage table';
END
GO

PRINT '=== Migration completed successfully ===';

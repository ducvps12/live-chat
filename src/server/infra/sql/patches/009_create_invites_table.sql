-- Create Invites table for workspace member invitations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Invites' AND schema_id = SCHEMA_ID('iam'))
BEGIN
    CREATE TABLE iam.Invites (
        InviteKey BIGINT IDENTITY(1,1) PRIMARY KEY,
        InviteId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL UNIQUE,
        WorkspaceKey BIGINT NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        RoleName NVARCHAR(100) NOT NULL,
        Token NVARCHAR(255) NOT NULL UNIQUE,
        Status TINYINT DEFAULT 1 NOT NULL, -- 1=Pending, 2=Accepted, 3=Revoked, 4=Expired
        InvitedByMembershipKey BIGINT NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
        
        CONSTRAINT FK_Invites_Workspace FOREIGN KEY (WorkspaceKey) 
            REFERENCES iam.Workspaces(WorkspaceKey),
        CONSTRAINT FK_Invites_InvitedBy FOREIGN KEY (InvitedByMembershipKey) 
            REFERENCES iam.Memberships(MembershipKey)
    );

    -- Indexes for performance
    CREATE INDEX IX_Invites_WorkspaceKey_Status ON iam.Invites(WorkspaceKey, Status);
    CREATE INDEX IX_Invites_Email_Status ON iam.Invites(Email, Status);
    CREATE INDEX IX_Invites_Token ON iam.Invites(Token);
    CREATE INDEX IX_Invites_ExpiresAt ON iam.Invites(ExpiresAt);
    
    PRINT 'Created table iam.Invites with indexes';
END
ELSE
BEGIN
    PRINT 'Table iam.Invites already exists';
END
GO

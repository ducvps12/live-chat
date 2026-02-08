-- Recreate Invites table with correct schema
DROP TABLE IF EXISTS iam.Invites;

CREATE TABLE iam.Invites (
    InviteKey BIGINT IDENTITY(1,1) PRIMARY KEY,
    InviteId UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL UNIQUE,
    WorkspaceKey BIGINT NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    RoleName NVARCHAR(100) NOT NULL,
    TokenHash NVARCHAR(64) NOT NULL UNIQUE,
    InvitedByMembershipKey BIGINT NOT NULL,
    Status TINYINT DEFAULT 1 NOT NULL, -- 1=Pending, 2=Accepted, 3=Expired, 4=Revoked
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
    UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME() NOT NULL,
    
    CONSTRAINT FK_Invites_Workspace FOREIGN KEY (WorkspaceKey) 
        REFERENCES iam.Workspaces(WorkspaceKey),
    CONSTRAINT FK_Invites_InvitedBy FOREIGN KEY (InvitedByMembershipKey) 
        REFERENCES iam.Memberships(MembershipKey)
);

-- Indexes
CREATE INDEX IX_Invites_WorkspaceKey_Status ON iam.Invites(WorkspaceKey, Status);
CREATE INDEX IX_Invites_Email_Status ON iam.Invites(Email, Status);
CREATE INDEX IX_Invites_ExpiresAt ON iam.Invites(ExpiresAt);

PRINT 'Recreated iam.Invites table with TokenHash';

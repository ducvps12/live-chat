-- =====================================================
-- Live Chat MySQL Schema
-- Converted from MSSQL (iam schema) + MongoDB collections
-- All tables in single database, prefixed with iam_ or channels_
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================================
-- IAM TABLES (from MSSQL iam schema)
-- =====================================================

-- Users
CREATE TABLE IF NOT EXISTS iam_Users (
    UserKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    UserId CHAR(36) NOT NULL DEFAULT (UUID()),
    Email VARCHAR(320) NOT NULL,
    EmailNormalized VARCHAR(320) NOT NULL,
    DisplayName VARCHAR(200) NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=active, 2=inactive, 3=locked, 4=unverified
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    IsSystemAdmin TINYINT(1) NOT NULL DEFAULT 0,
    -- Profile fields (from patch_auth_improvements)
    EmailVerified TINYINT(1) NOT NULL DEFAULT 0,
    EmailVerificationToken VARCHAR(500) NULL,
    EmailVerificationExpiry DATETIME(3) NULL,
    FirstName VARCHAR(100) NULL,
    LastName VARCHAR(100) NULL,
    AvatarUrl VARCHAR(500) NULL,
    Language VARCHAR(10) NULL DEFAULT 'vi',
    Timezone VARCHAR(50) NULL DEFAULT 'Asia/Ho_Chi_Minh',
    -- Google OAuth (from add_google_id_column)
    GoogleId VARCHAR(255) NULL,
    UNIQUE KEY UQ_Users_Email (EmailNormalized),
    UNIQUE KEY UQ_Users_UserId (UserId),
    INDEX IX_Users_GoogleId (GoogleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- UserCredentials
CREATE TABLE IF NOT EXISTS iam_UserCredentials (
    UserKey BIGINT NOT NULL PRIMARY KEY,
    PasswordHash TEXT NOT NULL,
    PasswordAlgo VARCHAR(30) NOT NULL,
    MustChangePassword TINYINT(1) NOT NULL DEFAULT 0,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    FailedLoginAttempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    LockUntil DATETIME(3) NULL,
    CONSTRAINT FK_UserCredentials_User FOREIGN KEY (UserKey) REFERENCES iam_Users(UserKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workspaces
CREATE TABLE IF NOT EXISTS iam_Workspaces (
    WorkspaceKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WorkspaceId CHAR(36) NOT NULL DEFAULT (UUID()),
    Name VARCHAR(255) NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 0=DRAFT, 1=ACTIVE, 2=ARCHIVED
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    Settings TEXT NULL,
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Workspaces_WorkspaceId (WorkspaceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Memberships
CREATE TABLE IF NOT EXISTS iam_Memberships (
    MembershipKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    MembershipId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    UserKey BIGINT NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Memberships (WorkspaceKey, UserKey),
    CONSTRAINT FK_Memberships_User FOREIGN KEY (UserKey) REFERENCES iam_Users(UserKey),
    CONSTRAINT FK_Memberships_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles
CREATE TABLE IF NOT EXISTS iam_Roles (
    RoleKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    RoleId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Roles (WorkspaceKey, Name),
    CONSTRAINT FK_Roles_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MembershipRoles
CREATE TABLE IF NOT EXISTS iam_MembershipRoles (
    MembershipKey BIGINT NOT NULL,
    RoleKey BIGINT NOT NULL,
    PRIMARY KEY (MembershipKey, RoleKey),
    CONSTRAINT FK_MembershipRoles_Membership FOREIGN KEY (MembershipKey) REFERENCES iam_Memberships(MembershipKey) ON DELETE CASCADE,
    CONSTRAINT FK_MembershipRoles_Role FOREIGN KEY (RoleKey) REFERENCES iam_Roles(RoleKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions
CREATE TABLE IF NOT EXISTS iam_Permissions (
    PermissionKey INT AUTO_INCREMENT PRIMARY KEY,
    Code VARCHAR(150) NOT NULL,
    Resource VARCHAR(80) NOT NULL,
    `Action` VARCHAR(80) NOT NULL,
    UNIQUE KEY UQ_Permissions_Code (Code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RolePermissionGrants
CREATE TABLE IF NOT EXISTS iam_RolePermissionGrants (
    GrantKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    RoleKey BIGINT NOT NULL,
    PermissionKey INT NOT NULL,
    Effect TINYINT NOT NULL, -- 1=Allow, 2=Deny
    UNIQUE KEY UQ_RolePermissionGrants (RoleKey, PermissionKey),
    CONSTRAINT FK_RPG_Role FOREIGN KEY (RoleKey) REFERENCES iam_Roles(RoleKey),
    CONSTRAINT FK_RPG_Permission FOREIGN KEY (PermissionKey) REFERENCES iam_Permissions(PermissionKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GrantScopes
CREATE TABLE IF NOT EXISTS iam_GrantScopes (
    GrantKey BIGINT NOT NULL,
    ResourceKey BIGINT NULL,
    ResourceKeyNN BIGINT GENERATED ALWAYS AS (IFNULL(ResourceKey, 0)) STORED NOT NULL,
    PRIMARY KEY (GrantKey, ResourceKeyNN),
    CONSTRAINT FK_GrantScopes_Grant FOREIGN KEY (GrantKey) REFERENCES iam_RolePermissionGrants(GrantKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ResourceTypes
CREATE TABLE IF NOT EXISTS iam_ResourceTypes (
    ResourceTypeKey SMALLINT AUTO_INCREMENT PRIMARY KEY,
    Code VARCHAR(50) NOT NULL,
    UNIQUE KEY UQ_ResourceTypes_Code (Code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resources
CREATE TABLE IF NOT EXISTS iam_Resources (
    ResourceKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WorkspaceKey BIGINT NOT NULL,
    ResourceTypeKey SMALLINT NOT NULL,
    ExternalId CHAR(36) NOT NULL,
    UNIQUE KEY UQ_Resources (WorkspaceKey, ResourceTypeKey, ExternalId),
    CONSTRAINT FK_Resources_Type FOREIGN KEY (ResourceTypeKey) REFERENCES iam_ResourceTypes(ResourceTypeKey),
    CONSTRAINT FK_Resources_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MembershipEffectivePermissions
CREATE TABLE IF NOT EXISTS iam_MembershipEffectivePermissions (
    MembershipKey BIGINT NOT NULL,
    PermissionKey INT NOT NULL,
    ResourceKey BIGINT NULL,
    ResourceKeyNN BIGINT GENERATED ALWAYS AS (IFNULL(ResourceKey, 0)) STORED NOT NULL,
    Effect TINYINT NOT NULL,
    SourceType TINYINT NOT NULL,
    PRIMARY KEY (MembershipKey, PermissionKey, ResourceKeyNN, Effect, SourceType),
    CONSTRAINT FK_MEP_Membership FOREIGN KEY (MembershipKey) REFERENCES iam_Memberships(MembershipKey) ON DELETE CASCADE,
    CONSTRAINT FK_MEP_Permission FOREIGN KEY (PermissionKey) REFERENCES iam_Permissions(PermissionKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MembershipPermissionOverrides
CREATE TABLE IF NOT EXISTS iam_MembershipPermissionOverrides (
    OverrideKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    MembershipKey BIGINT NOT NULL,
    PermissionKey INT NOT NULL,
    ResourceKey BIGINT NULL,
    Effect TINYINT NOT NULL,
    ExpiresAt DATETIME(3) NULL,
    UNIQUE KEY UQ_MembershipOverrides (MembershipKey, PermissionKey, ResourceKey),
    CONSTRAINT FK_MO_Membership FOREIGN KEY (MembershipKey) REFERENCES iam_Memberships(MembershipKey) ON DELETE CASCADE,
    CONSTRAINT FK_MO_Permission FOREIGN KEY (PermissionKey) REFERENCES iam_Permissions(PermissionKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RefreshTokens
CREATE TABLE IF NOT EXISTS iam_RefreshTokens (
    RefreshTokenKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    UserKey BIGINT NOT NULL,
    TokenHash TEXT NOT NULL,
    ExpiresAt DATETIME(3) NOT NULL,
    RevokedAt DATETIME(3) NULL,
    FamilyId CHAR(36) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    CreatedByIp VARCHAR(50) NULL,
    UserAgent VARCHAR(500) NULL,
    CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserKey) REFERENCES iam_Users(UserKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Widgets
CREATE TABLE IF NOT EXISTS iam_Widgets (
    WidgetKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WidgetId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Name VARCHAR(120) NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    SiteKey VARCHAR(64) NULL,
    AllowedDomains TEXT NOT NULL,
    Theme TEXT NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Widgets_WidgetId (WidgetId),
    UNIQUE KEY UQ_Widgets_SiteKey (SiteKey),
    INDEX IX_Widgets_WorkspaceKey (WorkspaceKey),
    CONSTRAINT FK_Widgets_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WidgetConversations
CREATE TABLE IF NOT EXISTS iam_WidgetConversations (
    ConversationKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    ConversationId CHAR(36) NOT NULL DEFAULT (UUID()),
    WidgetKey BIGINT NOT NULL,
    VisitorId VARCHAR(80) NOT NULL,
    VisitorName VARCHAR(100) NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=Open, 2=Closed
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    LastMessageAt DATETIME(3) NULL,
    SourceUrl TEXT NULL,
    LastMessageSeq INT NULL,
    LastMessagePreview TEXT NULL,
    LastMessageMongoId VARCHAR(100) NULL,
    MessageCount INT NOT NULL DEFAULT 0,
    VisitorMessageCount INT NOT NULL DEFAULT 0,
    AssignedUserKey BIGINT NULL,
    UNIQUE KEY UQ_WidgetConversations_ConversationId (ConversationId),
    INDEX IX_WidgetConversations_Lookup (WidgetKey, VisitorId, Status),
    INDEX IX_WidgetConversations_Active (WidgetKey, Status, LastMessageAt),
    CONSTRAINT FK_WidgetConversations_Widget FOREIGN KEY (WidgetKey) REFERENCES iam_Widgets(WidgetKey),
    CONSTRAINT FK_WidgetConversations_AssignedUser FOREIGN KEY (AssignedUserKey) REFERENCES iam_Users(UserKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WidgetMessages
CREATE TABLE IF NOT EXISTS iam_WidgetMessages (
    MessageKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    MessageId CHAR(36) NOT NULL DEFAULT (UUID()),
    ConversationKey BIGINT NOT NULL,
    SenderType TINYINT NOT NULL, -- 1=Visitor, 2=Agent, 3=System
    Content TEXT NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX IX_WidgetMessages_Conversation (ConversationKey, CreatedAt),
    CONSTRAINT FK_WidgetMessages_Conversation FOREIGN KEY (ConversationKey) REFERENCES iam_WidgetConversations(ConversationKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WidgetConversationReads
CREATE TABLE IF NOT EXISTS iam_WidgetConversationReads (
    ReadKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    ConversationKey BIGINT NOT NULL,
    UserKey BIGINT NOT NULL,
    LastReadVisitorCount INT NOT NULL DEFAULT 0,
    LastReadAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UK_WidgetConversationReads_Conv_User (ConversationKey, UserKey),
    INDEX IX_WidgetConversationReads_UserKey (UserKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WorkspaceInvites
CREATE TABLE IF NOT EXISTS iam_WorkspaceInvites (
    InviteKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    InviteId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Email VARCHAR(320) NOT NULL,
    RoleName VARCHAR(100) NOT NULL,
    InvitedByMembershipKey BIGINT NOT NULL,
    TokenHash VARCHAR(64) NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=Pending, 2=Accepted, 3=Expired, 4=Revoked
    ExpiresAt DATETIME(3) NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NULL,
    UNIQUE KEY UQ_WorkspaceInvites_InviteId (InviteId),
    UNIQUE KEY UQ_WorkspaceInvites_TokenHash (TokenHash),
    INDEX IX_WorkspaceInvites_Workspace_Status (WorkspaceKey, Status, ExpiresAt),
    INDEX IX_WorkspaceInvites_Email (Email, Status),
    CONSTRAINT FK_WorkspaceInvites_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey),
    CONSTRAINT FK_WorkspaceInvites_InvitedBy FOREIGN KEY (InvitedByMembershipKey) REFERENCES iam_Memberships(MembershipKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Images (SQL metadata, replaces MongoDB Image model)
CREATE TABLE IF NOT EXISTS iam_Images (
    ImageId BIGINT AUTO_INCREMENT PRIMARY KEY,
    Filename VARCHAR(255) NOT NULL,
    Base64 LONGTEXT NOT NULL,
    MimeType VARCHAR(100) NOT NULL,
    Size INT NOT NULL,
    UploadedBy BIGINT NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX IX_Images_Filename (Filename),
    INDEX IX_Images_UploadedBy_CreatedAt (UploadedBy, CreatedAt DESC),
    CONSTRAINT FK_Images_Users FOREIGN KEY (UploadedBy) REFERENCES iam_Users(UserKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invites
CREATE TABLE IF NOT EXISTS iam_Invites (
    InviteKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    InviteId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Email VARCHAR(255) NOT NULL,
    RoleName VARCHAR(100) NOT NULL,
    TokenHash VARCHAR(64) NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=Pending, 2=Accepted, 3=Expired, 4=Revoked
    InvitedByMembershipKey BIGINT NOT NULL,
    ExpiresAt DATETIME(3) NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Invites_InviteId (InviteId),
    UNIQUE KEY UQ_Invites_TokenHash (TokenHash),
    INDEX IX_Invites_WorkspaceKey_Status (WorkspaceKey, Status),
    INDEX IX_Invites_Email_Status (Email, Status),
    INDEX IX_Invites_ExpiresAt (ExpiresAt),
    CONSTRAINT FK_Invites_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey),
    CONSTRAINT FK_Invites_InvitedBy FOREIGN KEY (InvitedByMembershipKey) REFERENCES iam_Memberships(MembershipKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tickets (Kanban)
CREATE TABLE IF NOT EXISTS iam_Tickets (
    TicketKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    TicketId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    ConversationKey BIGINT NULL,
    Title VARCHAR(500) NOT NULL,
    Description TEXT NULL,
    Type TINYINT NOT NULL DEFAULT 1, -- 1=Ticket, 2=Task
    Status TINYINT NOT NULL DEFAULT 1, -- 1=New, 2=InProgress, 3=Waiting, 4=Done
    Priority TINYINT NOT NULL DEFAULT 2, -- 1=Low, 2=Medium, 3=High, 4=Critical
    AssigneeUserKey BIGINT NULL,
    ReporterUserKey BIGINT NOT NULL,
    DueDate DATETIME(3) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    CompletedAt DATETIME(3) NULL,
    Position INT NOT NULL DEFAULT 0,
    INDEX IX_Tickets_Workspace (WorkspaceKey),
    INDEX IX_Tickets_Status (Status),
    INDEX IX_Tickets_Assignee (AssigneeUserKey),
    INDEX IX_Tickets_Type (Type),
    CONSTRAINT FK_Tickets_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey),
    CONSTRAINT FK_Tickets_Assignee FOREIGN KEY (AssigneeUserKey) REFERENCES iam_Users(UserKey),
    CONSTRAINT FK_Tickets_Reporter FOREIGN KEY (ReporterUserKey) REFERENCES iam_Users(UserKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    LogKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    LogId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NULL,
    UserKey BIGINT NULL,
    Action VARCHAR(100) NOT NULL,
    ResourceType VARCHAR(50) NULL,
    ResourceId VARCHAR(100) NULL,
    Metadata TEXT NULL,
    IpAddress VARCHAR(50) NULL,
    UserAgent VARCHAR(500) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_AuditLogs_LogId (LogId),
    INDEX IX_AuditLogs_Workspace (WorkspaceKey),
    INDEX IX_AuditLogs_User (UserKey),
    INDEX IX_AuditLogs_CreatedAt (CreatedAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversation Notes
CREATE TABLE IF NOT EXISTS iam_ConversationNotes (
    NoteKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    NoteId CHAR(36) NOT NULL DEFAULT (UUID()),
    ConversationKey BIGINT NOT NULL,
    UserKey BIGINT NOT NULL,
    Content TEXT NOT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_ConversationNotes_NoteId (NoteId),
    INDEX IX_ConversationNotes_Conv (ConversationKey),
    CONSTRAINT FK_ConversationNotes_Conv FOREIGN KEY (ConversationKey) REFERENCES iam_WidgetConversations(ConversationKey),
    CONSTRAINT FK_ConversationNotes_User FOREIGN KEY (UserKey) REFERENCES iam_Users(UserKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tags
CREATE TABLE IF NOT EXISTS iam_Tags (
    TagKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    TagId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Tags_TagId (TagId),
    UNIQUE KEY UQ_Tags_Workspace_Name (WorkspaceKey, Name),
    CONSTRAINT FK_Tags_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversation Tags (many-to-many)
CREATE TABLE IF NOT EXISTS iam_ConversationTags (
    ConversationKey BIGINT NOT NULL,
    TagKey BIGINT NOT NULL,
    PRIMARY KEY (ConversationKey, TagKey),
    CONSTRAINT FK_ConvTags_Conv FOREIGN KEY (ConversationKey) REFERENCES iam_WidgetConversations(ConversationKey),
    CONSTRAINT FK_ConvTags_Tag FOREIGN KEY (TagKey) REFERENCES iam_Tags(TagKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CHANNELS TABLES (from channels schema)
-- =====================================================

-- Facebook Pages
CREATE TABLE IF NOT EXISTS channels_FacebookPages (
    PageKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    PageId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    FacebookPageId VARCHAR(50) NOT NULL,
    FacebookPageName VARCHAR(255) NOT NULL,
    FacebookPageAvatar VARCHAR(500) NULL,
    PageAccessToken TEXT NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=Active, 2=Disconnected, 3=TokenExpired, 4=Error
    LastSyncAt DATETIME(3) NULL,
    ErrorMessage VARCHAR(500) NULL,
    Settings TEXT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_FacebookPages_PageId (PageId),
    UNIQUE KEY UQ_FacebookPages_Workspace_FBPage (WorkspaceKey, FacebookPageId),
    INDEX IX_FacebookPages_FacebookPageId (FacebookPageId),
    CONSTRAINT FK_FacebookPages_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Facebook Conversations
CREATE TABLE IF NOT EXISTS channels_FacebookConversations (
    ConversationKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    ConversationId CHAR(36) NOT NULL DEFAULT (UUID()),
    PageKey BIGINT NOT NULL,
    FacebookConversationId VARCHAR(100) NOT NULL,
    FacebookSenderId VARCHAR(50) NOT NULL,
    SenderName VARCHAR(255) NULL,
    SenderAvatar VARCHAR(500) NULL,
    Status TINYINT NOT NULL DEFAULT 1, -- 1=Open, 2=Closed
    AssignedToUserKey BIGINT NULL,
    LastMessageAt DATETIME(3) NULL,
    LastMessagePreview VARCHAR(500) NULL,
    UnreadCount INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_FacebookConversations_Id (ConversationId),
    UNIQUE KEY UQ_FacebookConversations_Page_Sender (PageKey, FacebookSenderId),
    INDEX IX_FacebookConversations_PageKey (PageKey),
    INDEX IX_FacebookConversations_Status (Status),
    CONSTRAINT FK_FacebookConversations_Page FOREIGN KEY (PageKey) REFERENCES channels_FacebookPages(PageKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Instagram Accounts
CREATE TABLE IF NOT EXISTS channels_InstagramAccounts (
    AccountKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    AccountId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    InstagramBusinessId VARCHAR(50) NOT NULL,
    InstagramUsername VARCHAR(100) NOT NULL,
    InstagramName VARCHAR(255) NULL,
    InstagramAvatar VARCHAR(500) NULL,
    LinkedFacebookPageId VARCHAR(50) NOT NULL,
    LinkedFacebookPageName VARCHAR(255) NULL,
    PageAccessToken TEXT NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    LastSyncAt DATETIME(3) NULL,
    ErrorMessage VARCHAR(500) NULL,
    Settings TEXT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_InstagramAccounts_AccountId (AccountId),
    UNIQUE KEY UQ_InstagramAccounts_Workspace_IG (WorkspaceKey, InstagramBusinessId),
    INDEX IX_InstagramAccounts_InstagramBusinessId (InstagramBusinessId),
    INDEX IX_InstagramAccounts_Status (Status),
    CONSTRAINT FK_InstagramAccounts_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhooks
CREATE TABLE IF NOT EXISTS channels_Webhooks (
    WebhookKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WebhookId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Url VARCHAR(500) NOT NULL,
    Secret VARCHAR(100) NULL,
    Events TEXT NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    LastTriggeredAt DATETIME(3) NULL,
    SuccessCount INT NOT NULL DEFAULT 0,
    FailCount INT NOT NULL DEFAULT 0,
    LastError VARCHAR(500) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Webhooks_WebhookId (WebhookId),
    INDEX IX_Webhooks_WorkspaceKey (WorkspaceKey),
    INDEX IX_Webhooks_Status (Status),
    CONSTRAINT FK_Webhooks_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WebhookLogs
CREATE TABLE IF NOT EXISTS channels_WebhookLogs (
    LogKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WebhookKey BIGINT NOT NULL,
    EventType VARCHAR(50) NOT NULL,
    Payload TEXT NULL,
    ResponseStatus INT NULL,
    ResponseBody TEXT NULL,
    ResponseTime INT NULL,
    Success TINYINT(1) NOT NULL DEFAULT 1,
    Error VARCHAR(500) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX IX_WebhookLogs_WebhookKey (WebhookKey),
    INDEX IX_WebhookLogs_CreatedAt (CreatedAt DESC),
    CONSTRAINT FK_WebhookLogs_Webhook FOREIGN KEY (WebhookKey) REFERENCES channels_Webhooks(WebhookKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CallCenterNumbers
CREATE TABLE IF NOT EXISTS channels_CallCenterNumbers (
    NumberKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    NumberId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    PhoneNumber VARCHAR(20) NOT NULL,
    FriendlyName VARCHAR(100) NULL,
    Provider VARCHAR(50) NOT NULL DEFAULT 'twilio',
    ProviderNumberSid VARCHAR(100) NOT NULL,
    Capabilities TEXT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    Settings TEXT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_CallCenterNumbers_NumberId (NumberId),
    UNIQUE KEY UQ_CallCenterNumbers_PhoneNumber (PhoneNumber),
    INDEX IX_CallCenterNumbers_WorkspaceKey (WorkspaceKey),
    CONSTRAINT FK_CallCenterNumbers_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calls
CREATE TABLE IF NOT EXISTS channels_Calls (
    CallKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    CallId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    NumberKey BIGINT NOT NULL,
    ProviderCallSid VARCHAR(100) NULL,
    Direction VARCHAR(10) NOT NULL,
    FromNumber VARCHAR(20) NOT NULL,
    ToNumber VARCHAR(20) NOT NULL,
    CallerName VARCHAR(255) NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'queued',
    Duration INT NULL,
    QueueTime INT NULL,
    RecordingUrl VARCHAR(500) NULL,
    RecordingSid VARCHAR(100) NULL,
    TranscriptText TEXT NULL,
    AssignedToUserKey BIGINT NULL,
    ConversationKey BIGINT NULL,
    StartedAt DATETIME(3) NULL,
    AnsweredAt DATETIME(3) NULL,
    EndedAt DATETIME(3) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_Calls_CallId (CallId),
    INDEX IX_Calls_WorkspaceKey (WorkspaceKey),
    INDEX IX_Calls_NumberKey (NumberKey),
    INDEX IX_Calls_Status (Status),
    INDEX IX_Calls_CreatedAt (CreatedAt DESC),
    INDEX IX_Calls_ProviderCallSid (ProviderCallSid),
    CONSTRAINT FK_Calls_Number FOREIGN KEY (NumberKey) REFERENCES channels_CallCenterNumbers(NumberKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CallCenterSettings
CREATE TABLE IF NOT EXISTS channels_CallCenterSettings (
    SettingKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WorkspaceKey BIGINT NOT NULL,
    TwilioAccountSid VARCHAR(100) NULL,
    TwilioAuthToken VARCHAR(100) NULL,
    TwilioApiKeySid VARCHAR(100) NULL,
    TwilioApiKeySecret VARCHAR(100) NULL,
    RecordCalls TINYINT(1) NOT NULL DEFAULT 0,
    TranscribeCalls TINYINT(1) NOT NULL DEFAULT 0,
    MaxQueueTime INT NOT NULL DEFAULT 300,
    WelcomeMessage VARCHAR(500) NULL,
    HoldMusicUrl VARCHAR(500) NULL,
    WorkingHours TEXT NULL,
    OutOfHoursMessage VARCHAR(500) NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_CallCenterSettings_Workspace (WorkspaceKey),
    CONSTRAINT FK_CallCenterSettings_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Accounts
CREATE TABLE IF NOT EXISTS channels_WhatsAppAccounts (
    AccountKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    AccountId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    PhoneNumberId VARCHAR(100) NOT NULL,
    DisplayNumber VARCHAR(50) NOT NULL,
    BusinessAccountId VARCHAR(100) NOT NULL,
    AccessToken TEXT NOT NULL,
    Status TINYINT NOT NULL DEFAULT 1,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_WhatsAppAccounts_AccountId (AccountId),
    UNIQUE KEY UQ_WhatsAppAccounts_PhoneNumberId (PhoneNumberId),
    INDEX IX_WhatsAppAccounts_WorkspaceKey (WorkspaceKey),
    CONSTRAINT FK_WhatsAppAccounts_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BOT & AI TABLES
-- =====================================================

-- Bot Rules
CREATE TABLE IF NOT EXISTS iam_BotRules (
    RuleKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    RuleId CHAR(36) NOT NULL DEFAULT (UUID()),
    WorkspaceKey BIGINT NOT NULL,
    Name VARCHAR(255) NOT NULL,
    TriggerType VARCHAR(50) NOT NULL,
    TriggerValue TEXT NULL,
    TriggerConfig TEXT NULL,
    ResponseType VARCHAR(50) NOT NULL DEFAULT 'text',
    ResponseContent TEXT NULL,
    Priority INT NOT NULL DEFAULT 100,
    IsActive TINYINT(1) NOT NULL DEFAULT 1,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_BotRules_RuleId (RuleId),
    INDEX IX_BotRules_WorkspaceKey (WorkspaceKey),
    INDEX IX_BotRules_Priority (WorkspaceKey, Priority),
    CONSTRAINT FK_BotRules_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bot Settings
CREATE TABLE IF NOT EXISTS iam_BotSettings (
    SettingKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WorkspaceKey BIGINT NOT NULL,
    IsEnabled TINYINT(1) NOT NULL DEFAULT 1,
    WelcomeMessage TEXT NULL,
    OfflineMessage TEXT NULL,
    IdleTimeoutSeconds INT NOT NULL DEFAULT 60,
    TransferToAgentAfterFails INT NOT NULL DEFAULT 3,
    AiEnabled TINYINT(1) NOT NULL DEFAULT 0,
    AiModel VARCHAR(100) NULL DEFAULT 'gemini-2.5-flash',
    AiSystemPrompt TEXT NULL,
    AiMaxTokens INT NOT NULL DEFAULT 500,
    AiTemperature DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UpdatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_BotSettings_Workspace (WorkspaceKey),
    CONSTRAINT FK_BotSettings_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Usage Tracking
CREATE TABLE IF NOT EXISTS iam_AiUsage (
    UsageKey BIGINT AUTO_INCREMENT PRIMARY KEY,
    WorkspaceKey BIGINT NOT NULL,
    ConversationId CHAR(36) NULL,
    Model VARCHAR(100) NOT NULL,
    PromptTokens INT NOT NULL DEFAULT 0,
    CompletionTokens INT NOT NULL DEFAULT 0,
    TotalTokens INT NOT NULL DEFAULT 0,
    ResponseTimeMs INT NOT NULL DEFAULT 0,
    Success TINYINT(1) NOT NULL DEFAULT 1,
    ErrorMessage TEXT NULL,
    CreatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX IX_AiUsage_WorkspaceKey (WorkspaceKey),
    INDEX IX_AiUsage_CreatedAt (CreatedAt DESC),
    CONSTRAINT FK_AiUsage_Workspace FOREIGN KEY (WorkspaceKey) REFERENCES iam_Workspaces(WorkspaceKey) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CHAT TABLES (from MongoDB)
-- =====================================================

-- ChatMessages (replaces MongoDB chatmessages collection)
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversationId VARCHAR(36) NOT NULL,
    conversationKey BIGINT NOT NULL,
    seq INT NULL,
    senderType TINYINT NOT NULL, -- 1=visitor, 2=agent, 3=system
    senderId VARCHAR(100) NULL,
    content VARCHAR(2000) NOT NULL,
    clientMsgId VARCHAR(100) NULL,
    isRead TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX IX_chat_messages_convKey_seq (conversationKey, seq DESC),
    INDEX IX_chat_messages_convKey_createdAt (conversationKey, createdAt DESC),
    INDEX IX_chat_messages_convId_createdAt (conversationId, createdAt DESC),
    UNIQUE KEY UQ_chat_messages_convKey_clientMsgId (conversationKey, clientMsgId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ConversationCounters (replaces MongoDB conversationcounters)
CREATE TABLE IF NOT EXISTS conversation_counters (
    conversationKey BIGINT NOT NULL PRIMARY KEY,
    nextSeq INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ConversationReadPointers (replaces MongoDB conversationreadpointers)
CREATE TABLE IF NOT EXISTS conversation_read_pointers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversationKey BIGINT NOT NULL,
    membershipKey BIGINT NOT NULL,
    visitorId VARCHAR(100) NULL,
    lastDeliveredSeq INT NOT NULL DEFAULT 0,
    lastSeenSeq INT NOT NULL DEFAULT 0,
    createdAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updatedAt DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY UQ_read_pointers_conv_member (conversationKey, membershipKey),
    INDEX IX_read_pointers_conv_visitor (conversationKey, visitorId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

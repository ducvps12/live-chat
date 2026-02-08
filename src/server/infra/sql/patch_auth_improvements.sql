-- =============================================
-- Authentication & Profile Improvements
-- Adds email verification and user profile fields
-- =============================================

USE [live_chat_nemark]
GO

-- Add email verification fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerified')
BEGIN
    ALTER TABLE iam.Users
        ADD EmailVerified BIT NOT NULL DEFAULT 0;
    PRINT 'Added EmailVerified column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerificationToken')
BEGIN
    ALTER TABLE iam.Users
        ADD EmailVerificationToken NVARCHAR(500) NULL;
    PRINT 'Added EmailVerificationToken column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerificationExpiry')
BEGIN
    ALTER TABLE iam.Users
        ADD EmailVerificationExpiry DATETIME2(3) NULL;
    PRINT 'Added EmailVerificationExpiry column';
END

-- Add profile fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'FirstName')
BEGIN
    ALTER TABLE iam.Users
        ADD FirstName NVARCHAR(100) NULL;
    PRINT 'Added FirstName column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'LastName')
BEGIN
    ALTER TABLE iam.Users
        ADD LastName NVARCHAR(100) NULL;
    PRINT 'Added LastName column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'AvatarUrl')
BEGIN
    ALTER TABLE iam.Users
        ADD AvatarUrl NVARCHAR(500) NULL;
    PRINT 'Added AvatarUrl column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'Language')
BEGIN
    ALTER TABLE iam.Users
        ADD Language NVARCHAR(10) NULL DEFAULT 'vi';
    PRINT 'Added Language column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'Timezone')
BEGIN
    ALTER TABLE iam.Users
        ADD Timezone NVARCHAR(50) NULL DEFAULT 'Asia/Ho_Chi_Minh';
    PRINT 'Added Timezone column';
END

-- Update Status constraint to include unverified (4)
-- Status values: 1=active, 2=inactive, 3=locked, 4=unverified
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Users_Status')
BEGIN
    ALTER TABLE iam.Users DROP CONSTRAINT CK_Users_Status;
    PRINT 'Dropped old CK_Users_Status constraint';
END

ALTER TABLE iam.Users ADD CONSTRAINT CK_Users_Status 
    CHECK (Status IN (1, 2, 3, 4));
PRINT 'Added new CK_Users_Status constraint with unverified status';

-- Set existing users as verified (they registered before verification was required)
UPDATE iam.Users
SET EmailVerified = 1
WHERE EmailVerified = 0 AND Status = 1;
PRINT 'Set existing active users as email verified';

GO

PRINT 'Migration completed successfully';

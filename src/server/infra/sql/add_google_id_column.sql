-- Add GoogleId column to Users table for Google OAuth
-- Run this script on your database

-- Check if column exists and add if not
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('iam.Users') 
    AND name = 'GoogleId'
)
BEGIN
    ALTER TABLE iam.Users ADD GoogleId NVARCHAR(255) NULL;
    PRINT 'Added GoogleId column to iam.Users';
END
ELSE
BEGIN
    PRINT 'GoogleId column already exists';
END
GO

-- Create index on GoogleId for faster lookups
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Users_GoogleId' 
    AND object_id = OBJECT_ID('iam.Users')
)
BEGIN
    CREATE INDEX IX_Users_GoogleId ON iam.Users(GoogleId) WHERE GoogleId IS NOT NULL;
    PRINT 'Created index IX_Users_GoogleId';
END
GO

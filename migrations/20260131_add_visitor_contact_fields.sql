-- Migration: Add VisitorPhone and VisitorEmail columns to WidgetConversations
-- Purpose: Enable smart contact extraction from Zalo messages
-- Date: 2026-01-31

-- Add VisitorPhone column if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'VisitorPhone'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD VisitorPhone NVARCHAR(20) NULL;
    PRINT 'Added VisitorPhone column';
END

-- Add VisitorEmail column if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'VisitorEmail'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD VisitorEmail NVARCHAR(255) NULL;
    PRINT 'Added VisitorEmail column';
END

-- Add VisitorAvatar column if not exists (for Zalo avatar sync)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'iam' 
    AND TABLE_NAME = 'WidgetConversations' 
    AND COLUMN_NAME = 'VisitorAvatar'
)
BEGIN
    ALTER TABLE iam.WidgetConversations ADD VisitorAvatar NVARCHAR(500) NULL;
    PRINT 'Added VisitorAvatar column';
END

GO

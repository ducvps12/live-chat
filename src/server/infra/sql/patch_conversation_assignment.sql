IF NOT EXISTS (
  SELECT * FROM sys.columns 
  WHERE object_id = OBJECT_ID(N'iam.WidgetConversations') 
  AND name = 'AssignedUserKey'
)
BEGIN
    ALTER TABLE iam.WidgetConversations
    ADD AssignedUserKey BIGINT NULL;

    ALTER TABLE iam.WidgetConversations
    ADD CONSTRAINT FK_WidgetConversations_AssignedUserKey
    FOREIGN KEY (AssignedUserKey) REFERENCES iam.Users(UserKey);
    
    PRINT 'Added AssignedUserKey column to iam.WidgetConversations';
END
ELSE
BEGIN
    PRINT 'AssignedUserKey column already exists';
END

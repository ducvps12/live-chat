-- Create Images table for storing image metadata
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Images' AND schema_id = SCHEMA_ID('iam'))
BEGIN
    CREATE TABLE iam.Images (
        ImageId BIGINT PRIMARY KEY IDENTITY(1,1),
        Filename NVARCHAR(255) NOT NULL,
        MongoDbId NVARCHAR(24) NOT NULL,
        UserId BIGINT NOT NULL,
        FileSize INT,
        MimeType NVARCHAR(100),
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Images_Users FOREIGN KEY (UserId) REFERENCES iam.Users(UserKey)
    );

    -- Create indexes for fast search
    CREATE NONCLUSTERED INDEX IX_Images_Filename ON iam.Images(Filename);
    CREATE NONCLUSTERED INDEX IX_Images_MongoDbId ON iam.Images(MongoDbId);
    CREATE NONCLUSTERED INDEX IX_Images_UserId_CreatedAt ON iam.Images(UserId, CreatedAt DESC);

    PRINT 'Table iam.Images created successfully with indexes';
END
ELSE
BEGIN
    PRINT 'Table iam.Images already exists';
END
GO

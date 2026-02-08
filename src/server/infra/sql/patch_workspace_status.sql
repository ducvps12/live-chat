/*
   FILE: patch_workspace_status.sql
   PURPOSE: Update Workspace Status constraint to support DRAFT/ACTIVE/ARCHIVED
   
   Status Values:
   - 0 = DRAFT (onboarding incomplete)
   - 1 = ACTIVE (operational, can receive conversations)
   - 2 = ARCHIVED (deprecated, no longer operational)
   
   SAFE FOR EXISTING DATA:
   - All existing workspaces have Status=1 (ACTIVE)
   - No data migration needed
*/

-- Drop existing constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Workspaces_Status')
BEGIN
    ALTER TABLE iam.Workspaces DROP CONSTRAINT CK_Workspaces_Status;
    PRINT 'Dropped existing CK_Workspaces_Status constraint';
END

-- Add new constraint with 3 values (0, 1, 2)
ALTER TABLE iam.Workspaces 
ADD CONSTRAINT CK_Workspaces_Status 
CHECK (Status IN (0, 1, 2));

PRINT 'Added new CK_Workspaces_Status constraint (0=DRAFT, 1=ACTIVE, 2=ARCHIVED)';

-- Add column description
EXEC sp_addextendedproperty 
  @name = N'MS_Description', 
  @value = N'0=DRAFT (onboarding incomplete), 1=ACTIVE (operational), 2=ARCHIVED (deprecated)', 
  @level0type = N'SCHEMA', @level0name = 'iam',
  @level1type = N'TABLE',  @level1name = 'Workspaces',
  @level2type = N'COLUMN', @level2name = 'Status';

PRINT 'Added column description for Status';

-- Verify existing data
PRINT '';
PRINT 'Current Workspace Status Distribution:';
SELECT 
    Status,
    CASE 
        WHEN Status = 0 THEN 'DRAFT'
        WHEN Status = 1 THEN 'ACTIVE'
        WHEN Status = 2 THEN 'ARCHIVED'
        ELSE 'UNKNOWN'
    END AS StatusName,
    COUNT(*) AS Count
FROM iam.Workspaces
GROUP BY Status
ORDER BY Status;

PRINT '';
PRINT 'Migration completed successfully!';

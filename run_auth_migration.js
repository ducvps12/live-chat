/**
 * Run SQL migrations for authentication improvements
 * Adds email verification and profile fields
 */
const { connectSql, getPool } = require('./src/infra/sql/pool');

async function runAuthMigration() {
    try {
        console.log('Connecting to database...');
        await connectSql();
        const pool = getPool();

        console.log('Running authentication improvements migration...\\n');

        // 1. Add EmailVerified column
        console.log('1. Adding EmailVerified column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerified')
            BEGIN
                ALTER TABLE iam.Users ADD EmailVerified BIT NOT NULL DEFAULT 0;
                PRINT 'Added EmailVerified column';
            END
        `);
        console.log('   ✓ EmailVerified column ready');

        // 2. Add EmailVerificationToken column
        console.log('2. Adding EmailVerificationToken column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerificationToken')
            BEGIN
                ALTER TABLE iam.Users ADD EmailVerificationToken NVARCHAR(500) NULL;
                PRINT 'Added EmailVerificationToken column';
            END
        `);
        console.log('   ✓ EmailVerificationToken column ready');

        // 3. Add EmailVerificationExpiry column
        console.log('3. Adding EmailVerificationExpiry column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'EmailVerificationExpiry')
            BEGIN
                ALTER TABLE iam.Users ADD EmailVerificationExpiry DATETIME2(3) NULL;
                PRINT 'Added EmailVerificationExpiry column';
            END
        `);
        console.log('   ✓ EmailVerificationExpiry column ready');

        // 4. Add FirstName column
        console.log('4. Adding FirstName column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'FirstName')
            BEGIN
                ALTER TABLE iam.Users ADD FirstName NVARCHAR(100) NULL;
                PRINT 'Added FirstName column';
            END
        `);
        console.log('   ✓ FirstName column ready');

        // 5. Add LastName column
        console.log('5. Adding LastName column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'LastName')
            BEGIN
                ALTER TABLE iam.Users ADD LastName NVARCHAR(100) NULL;
                PRINT 'Added LastName column';
            END
        `);
        console.log('   ✓ LastName column ready');

        // 6. Add AvatarUrl column
        console.log('6. Adding AvatarUrl column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'AvatarUrl')
            BEGIN
                ALTER TABLE iam.Users ADD AvatarUrl NVARCHAR(500) NULL;
                PRINT 'Added AvatarUrl column';
            END
        `);
        console.log('   ✓ AvatarUrl column ready');

        // 6.5. Add GoogleId column for Google OAuth
        console.log('6.5. Adding GoogleId column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'GoogleId')
            BEGIN
                ALTER TABLE iam.Users ADD GoogleId NVARCHAR(255) NULL;
                PRINT 'Added GoogleId column';
            END
        `);
        console.log('   ✓ GoogleId column ready');

        // 6.6. Create index on GoogleId
        console.log('6.6. Creating GoogleId index...');
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_GoogleId' AND object_id = OBJECT_ID('iam.Users'))
                CREATE NONCLUSTERED INDEX IX_Users_GoogleId
                ON iam.Users (GoogleId)
                WHERE GoogleId IS NOT NULL
            `);
            console.log('   ✓ GoogleId index created');
        } catch (e) {
            console.log('   GoogleId index may already exist');
        }

        // 7. Add Language column
        console.log('7. Adding Language column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'Language')
            BEGIN
                ALTER TABLE iam.Users ADD Language NVARCHAR(10) NULL DEFAULT 'vi';
                PRINT 'Added Language column';
            END
        `);
        console.log('   ✓ Language column ready');

        // 8. Add Timezone column
        console.log('8. Adding Timezone column...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('iam.Users') AND name = 'Timezone')
            BEGIN
                ALTER TABLE iam.Users ADD Timezone NVARCHAR(50) NULL DEFAULT 'Asia/Ho_Chi_Minh';
                PRINT 'Added Timezone column';
            END
        `);
        console.log('   ✓ Timezone column ready');

        // 9. Update Status constraint to include unverified (4)
        console.log('9. Updating Status constraint...');
        await pool.request().query(`
            IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Users_Status' AND parent_object_id = OBJECT_ID('iam.Users'))
            BEGIN
                ALTER TABLE iam.Users DROP CONSTRAINT CK_Users_Status;
            END
            
            ALTER TABLE iam.Users ADD CONSTRAINT CK_Users_Status 
                CHECK (Status IN (1, 2, 3, 4));
        `);
        console.log('   ✓ Status constraint updated (1=active, 2=inactive, 3=locked, 4=unverified)');

        // 10. Set existing users as verified
        console.log('10. Setting existing users as verified...');
        const updateResult = await pool.request().query(`
            UPDATE iam.Users
            SET EmailVerified = 1
            WHERE EmailVerified = 0 AND Status = 1
        `);
        console.log(`   ✓ Set ${updateResult.rowsAffected[0]} existing users as verified`);

        // 11. Create index for email verification token lookup
        console.log('11. Creating email verification token index...');
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_EmailVerificationToken' AND object_id = OBJECT_ID('iam.Users'))
                CREATE NONCLUSTERED INDEX IX_Users_EmailVerificationToken
                ON iam.Users (EmailVerificationToken)
                WHERE EmailVerificationToken IS NOT NULL
            `);
            console.log('   ✓ Email verification token index created');
        } catch (e) {
            console.log('   Index may already exist');
        }

        console.log('\\n✅ Authentication improvements migration complete!');
        console.log('\\nNew fields added to iam.Users:');
        console.log('  - EmailVerified (BIT)');
        console.log('  - EmailVerificationToken (NVARCHAR 500)');
        console.log('  - EmailVerificationExpiry (DATETIME2)');
        console.log('  - FirstName (NVARCHAR 100)');
        console.log('  - LastName (NVARCHAR 100)');
        console.log('  - AvatarUrl (NVARCHAR 500)');
        console.log('  - Language (NVARCHAR 10, default: vi)');
        console.log('  - Timezone (NVARCHAR 50, default: Asia/Ho_Chi_Minh)');
        console.log('\\nStatus values updated: 1=active, 2=inactive, 3=locked, 4=unverified');

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runAuthMigration();

/**
 * Migration script for Bot Rules table
 * Run: node run_bot_migration.js
 */
const { connectSql, getPool, sql } = require('./src/infra/sql/pool');

async function runBotMigration() {
    try {
        console.log('Connecting to database...');
        await connectSql();
        const pool = getPool();

        console.log('Running Bot Rules migration...\n');

        // 1. Create BotRules table
        console.log('1. Creating iam.BotRules table...');
        await pool.request().query(`
            IF OBJECT_ID('iam.BotRules', 'U') IS NULL
            CREATE TABLE iam.BotRules (
                RuleKey BIGINT IDENTITY(1,1) NOT NULL,
                RuleId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                
                WorkspaceKey BIGINT NOT NULL,
                Name NVARCHAR(100) NOT NULL,
                TriggerType NVARCHAR(50) NOT NULL, -- 'keyword', 'first_message', 'idle', 'contains'
                TriggerValue NVARCHAR(500) NULL,
                TriggerConfig NVARCHAR(MAX) NULL, -- JSON config for complex triggers
                
                ResponseType NVARCHAR(50) NOT NULL DEFAULT 'text', -- 'text', 'buttons', 'card', 'transfer'
                ResponseContent NVARCHAR(MAX) NOT NULL,
                
                Priority INT NOT NULL DEFAULT 100,
                IsActive BIT NOT NULL DEFAULT 1,
                
                CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
                UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
                
                CONSTRAINT PK_BotRules PRIMARY KEY CLUSTERED (RuleKey),
                CONSTRAINT UQ_BotRules_RuleId UNIQUE (RuleId),
                CONSTRAINT FK_BotRules_Workspace 
                    FOREIGN KEY (WorkspaceKey) REFERENCES iam.Workspaces(WorkspaceKey)
            )
        `);
        console.log('   ✓ iam.BotRules table ready');

        // 2. Create indexes
        console.log('2. Creating indexes...');
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BotRules_Workspace_Active')
                CREATE NONCLUSTERED INDEX IX_BotRules_Workspace_Active 
                ON iam.BotRules (WorkspaceKey, IsActive, Priority)
                INCLUDE (TriggerType, TriggerValue, ResponseType, ResponseContent)
            `);
            console.log('   ✓ Index IX_BotRules_Workspace_Active created');
        } catch (e) {
            console.log('   Index may already exist:', e.message);
        }

        // 3. Create BotSettings table for workspace-level bot config
        console.log('3. Creating iam.BotSettings table...');
        await pool.request().query(`
            IF OBJECT_ID('iam.BotSettings', 'U') IS NULL
            CREATE TABLE iam.BotSettings (
                SettingKey BIGINT IDENTITY(1,1) NOT NULL,
                WorkspaceKey BIGINT NOT NULL,
                
                IsEnabled BIT NOT NULL DEFAULT 1,
                WelcomeMessage NVARCHAR(500) NULL,
                OfflineMessage NVARCHAR(500) NULL,
                IdleTimeoutSeconds INT NOT NULL DEFAULT 60,
                TransferToAgentAfterFails INT NOT NULL DEFAULT 3,
                
                CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
                UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
                
                CONSTRAINT PK_BotSettings PRIMARY KEY CLUSTERED (SettingKey),
                CONSTRAINT UQ_BotSettings_Workspace UNIQUE (WorkspaceKey),
                CONSTRAINT FK_BotSettings_Workspace 
                    FOREIGN KEY (WorkspaceKey) REFERENCES iam.Workspaces(WorkspaceKey)
            )
        `);
        console.log('   ✓ iam.BotSettings table ready');

        // 4. Add sample rules for testing
        console.log('4. Checking for sample rules...');
        const rulesCheck = await pool.request().query(`SELECT COUNT(*) as count FROM iam.BotRules`);

        if (rulesCheck.recordset[0].count === 0) {
            console.log('   Adding sample bot rules...');

            // Get first workspace
            const wsResult = await pool.request().query(`SELECT TOP 1 WorkspaceKey FROM iam.Workspaces`);

            if (wsResult.recordset.length > 0) {
                const workspaceKey = wsResult.recordset[0].WorkspaceKey;

                // Sample rules
                const sampleRules = [
                    {
                        name: 'Welcome Message',
                        triggerType: 'first_message',
                        triggerValue: null,
                        responseType: 'text',
                        responseContent: 'Xin chào! Chào mừng bạn đến với Nemark Support. Tôi có thể giúp gì cho bạn?',
                        priority: 1
                    },
                    {
                        name: 'Greeting Response',
                        triggerType: 'keyword',
                        triggerValue: 'hello,hi,xin chào,chào',
                        responseType: 'text',
                        responseContent: 'Chào bạn! Bạn cần hỗ trợ về vấn đề gì ạ?',
                        priority: 10
                    },
                    {
                        name: 'Pricing Question',
                        triggerType: 'contains',
                        triggerValue: 'giá,price,bao nhiêu,chi phí',
                        responseType: 'buttons',
                        responseContent: JSON.stringify({
                            text: 'Bạn muốn biết thông tin về bảng giá? Vui lòng chọn:',
                            buttons: [
                                { label: 'Xem bảng giá', action: 'link', url: '/pricing' },
                                { label: 'Tư vấn trực tiếp', action: 'transfer' }
                            ]
                        }),
                        priority: 20
                    },
                    {
                        name: 'Support Request',
                        triggerType: 'contains',
                        triggerValue: 'hỗ trợ,support,giúp đỡ,help',
                        responseType: 'text',
                        responseContent: 'Tôi sẽ chuyển bạn đến nhân viên hỗ trợ ngay. Vui lòng đợi trong giây lát!',
                        priority: 30
                    }
                ];

                for (const rule of sampleRules) {
                    await pool.request()
                        .input('workspaceKey', sql.BigInt, workspaceKey)
                        .input('name', sql.NVarChar, rule.name)
                        .input('triggerType', sql.NVarChar, rule.triggerType)
                        .input('triggerValue', sql.NVarChar, rule.triggerValue)
                        .input('responseType', sql.NVarChar, rule.responseType)
                        .input('responseContent', sql.NVarChar, rule.responseContent)
                        .input('priority', sql.Int, rule.priority)
                        .query(`
                            INSERT INTO iam.BotRules (WorkspaceKey, Name, TriggerType, TriggerValue, ResponseType, ResponseContent, Priority)
                            VALUES (@workspaceKey, @name, @triggerType, @triggerValue, @responseType, @responseContent, @priority)
                        `);
                }

                console.log(`   ✓ Added ${sampleRules.length} sample rules`);

                // Add bot settings
                await pool.request()
                    .input('workspaceKey', sql.BigInt, workspaceKey)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM iam.BotSettings WHERE WorkspaceKey = @workspaceKey)
                        INSERT INTO iam.BotSettings (WorkspaceKey, WelcomeMessage, OfflineMessage)
                        VALUES (@workspaceKey, N'Xin chào! Tôi là bot hỗ trợ tự động.', N'Hiện không có nhân viên trực. Vui lòng để lại tin nhắn!')
                    `);
                console.log('   ✓ Added default bot settings');
            }
        } else {
            console.log(`   ${rulesCheck.recordset[0].count} rules already exist`);
        }

        console.log('\n✅ Bot migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runBotMigration();

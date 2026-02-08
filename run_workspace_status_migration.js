const { execSync } = require('child_process');
const path = require('path');
const env = require('./src/config/env');

console.log('=== Workspace Status Migration ===');
console.log('');
console.log('This migration updates Workspace Status constraint:');
console.log('- Current: Status IN (1, 2)');
console.log('- New:     Status IN (0, 1, 2)');
console.log('');
console.log('Status Values:');
console.log('  0 = DRAFT    (onboarding incomplete)');
console.log('  1 = ACTIVE   (operational)');
console.log('  2 = ARCHIVED (deprecated)');
console.log('');
console.log('SAFE: All existing workspaces have Status=1 (ACTIVE)');
console.log('');

const sqlFile = path.join(__dirname, 'src', 'infra', 'sql', 'patch_workspace_status.sql');

const command = `sqlcmd -S ${env.sql.server} -d ${env.sql.database} -U ${env.sql.user} -P ${env.sql.password} -i "${sqlFile}"`;

try {
    console.log('Executing migration...');
    console.log('');

    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);

    console.log('');
    console.log('✅ Migration completed successfully!');
    process.exit(0);
} catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error(error.message);
    process.exit(1);
}

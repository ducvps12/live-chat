import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const publicNextDir = path.join(projectRoot, 'public', '_next');

try {
    await fs.rm(publicNextDir, { recursive: true, force: true });
    console.log('Cleaned public/_next directory before build.');
} catch (e) {
    // Ignore error if directory doesn't exist
}

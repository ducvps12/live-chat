import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceDir = path.resolve(projectRoot, '.next', 'static');
const publicDir = path.resolve(projectRoot, 'public');
const targetDir = path.resolve(publicDir, '_next', 'static');

if (!targetDir.startsWith(`${publicDir}${path.sep}`)) {
    throw new Error(`Refusing to replace an unsafe static target: ${targetDir}`);
}

const sourceStat = await fs.stat(sourceDir).catch(() => null);
if (!sourceStat?.isDirectory()) {
    throw new Error(`Next.js static output does not exist: ${sourceDir}`);
}

// This directory is generated exclusively by this script. Replacing it keeps
// old build IDs and hashed chunks from accumulating across deployments.
await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(targetDir), { recursive: true });
await fs.cp(sourceDir, targetDir, { recursive: true });

const copiedFiles = [];
const collectFiles = async (directory) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await collectFiles(entryPath);
        else copiedFiles.push(entryPath);
    }
};
await collectFiles(targetDir);

if (!copiedFiles.some((file) => file.endsWith('.js'))) {
    throw new Error(`No JavaScript chunks were mirrored into ${targetDir}`);
}

console.log(`Mirrored ${copiedFiles.length} Next.js static assets into public/_next/static`);

import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function exists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyFileRequired(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const targetPath = path.join(distDir, targetRelativePath);

  if (!(await exists(sourcePath))) {
    throw new Error(`Required static asset is missing: ${sourceRelativePath}`);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  console.log(`copied ${sourceRelativePath} -> dist/${targetRelativePath}`);
}

async function copyDirectoryIfExists(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const targetPath = path.join(distDir, targetRelativePath);

  if (!(await exists(sourcePath))) {
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.cp(sourcePath, targetPath, { recursive: true });
  console.log(`copied ${sourceRelativePath}/ -> dist/${targetRelativePath}/`);
}

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(distDir, { recursive: true });

await copyFileRequired('index.html');
await copyFileRequired('openapi.yaml');
await copyFileRequired('robots.txt');
await copyFileRequired('sitemap.xml');
await copyDirectoryIfExists('examples');

console.log('Static PROCatchem Lua API docs build completed.');

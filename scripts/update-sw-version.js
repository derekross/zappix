#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read package.json to get the version
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const packageVersion = packageJson.version;

// Create a unique version string with timestamp
const timestamp = Date.now();
const cacheVersion = `v${packageVersion}-${timestamp}`;

// Read the service worker file
const swPath = join(projectRoot, 'public', 'sw.js');
let swContent = readFileSync(swPath, 'utf8');

// Update the cache version
swContent = swContent.replace(
  /const CACHE_VERSION = "[^"]+";/,
  `const CACHE_VERSION = "${cacheVersion}";`
);

// Write the updated service worker
writeFileSync(swPath, swContent);

console.log(`Updated service worker cache version to: ${cacheVersion}`);
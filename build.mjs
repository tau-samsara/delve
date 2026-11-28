// Joins src/*.js (in filename order) into delve.user.js.
// Usage: node build.mjs          write delve.user.js
//        node build.mjs --check  fail if delve.user.js is not what src/ builds
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(root, 'src');
const target = path.join(root, 'delve.user.js');

const built = readdirSync(srcDir)
  .filter(name => name.endsWith('.js'))
  .sort()
  .map(name => readFileSync(path.join(srcDir, name), 'utf8'))
  .join('');

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== built) {
    console.error('delve.user.js is out of date with src/. Run: node build.mjs');
    process.exit(1);
  }
  console.log('delve.user.js matches src/');
} else {
  writeFileSync(target, built);
  console.log(`built delve.user.js from src/ (${built.split('\n').length - 1} lines)`);
}

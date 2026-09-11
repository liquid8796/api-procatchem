import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function collectFiles(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const fullPath = path.join(root, name);
    if (statSync(fullPath).isDirectory()) files.push(...collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

test('Script Builder uses the canonical Pokéball item name', () => {
  const files = [
    ...collectFiles('assets/builder').filter((file) => /\.(js|html|css)$/.test(file)),
    'scripts/emit-fixtures.mjs',
  ];
  const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(combined, /Pokeball/, 'legacy item spelling remains in Script Builder sources');
  assert.match(combined, /Pokéball/, 'canonical Pokéball item name is missing from Script Builder sources');
});

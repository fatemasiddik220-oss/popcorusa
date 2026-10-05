/**
 * scripts/patch-node18.cjs
 * Ensures full backward compatibility with Node.js v18 by polyfilling / patching
 * modern node:util features (styleText, parseEnv) in Vite and Rolldown if present.
 */

const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [pattern, replacement] of replacements) {
    if (typeof pattern === 'string') {
      if (content.includes(pattern)) {
        content = content.replace(pattern, replacement);
        changed = true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-node18] Successfully patched: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  return false;
}

function scanAndPatchDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanAndPatchDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      patchFile(fullPath, [
        // Patch rolldown import of formatWithOptions, styleText
        [
          /import\s*\{\s*formatWithOptions\s*,\s*styleText\s*\}\s*from\s*["']node:util["'];?/g,
          'import * as __nodeUtil__ from "node:util"; const formatWithOptions = __nodeUtil__.formatWithOptions || __nodeUtil__.format; const styleText = __nodeUtil__.styleText || ((_f, t) => t);'
        ],
        [
          /import\s*\{\s*styleText\s*,\s*formatWithOptions\s*\}\s*from\s*["']node:util["'];?/g,
          'import * as __nodeUtil__ from "node:util"; const formatWithOptions = __nodeUtil__.formatWithOptions || __nodeUtil__.format; const styleText = __nodeUtil__.styleText || ((_f, t) => t);'
        ],
        // Patch vite import of format, formatWithOptions, ..., parseEnv
        [
          /import\s*\{\s*format,\s*formatWithOptions,\s*inspect,\s*isDeepStrictEqual,\s*parseEnv,\s*promisify,\s*stripVTControlCharacters\s*\}\s*from\s*["']node:util["'];?/g,
          'import * as __viteUtil__ from "node:util"; const { format, formatWithOptions = format, inspect, isDeepStrictEqual, promisify, stripVTControlCharacters } = __viteUtil__; const parseEnv = __viteUtil__.parseEnv || ((e) => ({}));'
        ]
      ]);
    }
  }
}

try {
  const rolldownDir = path.join(process.cwd(), 'node_modules', 'rolldown');
  const viteDir = path.join(process.cwd(), 'node_modules', 'vite');

  if (fs.existsSync(rolldownDir)) {
    scanAndPatchDir(rolldownDir);
  }
  if (fs.existsSync(viteDir)) {
    scanAndPatchDir(viteDir);
  }
  console.log('[patch-node18] Compatibility check completed.');
} catch (err) {
  console.warn('[patch-node18] Notice during patch:', err.message);
}

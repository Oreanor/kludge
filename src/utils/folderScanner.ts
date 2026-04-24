import * as fs from 'fs';
import * as path from 'path';

const SCAN_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.cache', '__pycache__', '.vscode', '.idea',
]);

export function scanFolders(
  root: string,
  rel: string,
  depth: number,
  maxDepth: number,
): Array<{ name: string; path: string; depth: number }> {
  if (depth > maxDepth) { return []; }
  const result: Array<{ name: string; path: string; depth: number }> = [];
  try {
    const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || SCAN_EXCLUDE.has(e.name) || e.name.startsWith('.')) { continue; }
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      result.push({ name: e.name, path: relPath, depth });
      result.push(...scanFolders(root, relPath, depth + 1, maxDepth));
    }
  } catch {}
  return result;
}

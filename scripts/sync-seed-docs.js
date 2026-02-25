/**
 * Syncs docs/ → src/copilot_console/seed/copilot-console/docs/
 * Run automatically as part of the build pipeline.
 * Only copies .md files (not images/screenshots).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs');
const DEST = path.join(__dirname, '..', 'src', 'copilot_console', 'seed', 'copilot-console', 'docs');

function syncDir(src, dest, relPath = '') {
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip internal-only folders
      if (entry.name === 'design') continue;
      if (entry.name === 'features') continue;
      count += syncDir(srcPath, destPath, path.join(relPath, entry.name));
    } else if (entry.name.endsWith('.md')) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

// Clean destination first to remove stale files
if (fs.existsSync(DEST)) {
  // Only remove .md files, preserve non-md files if any
  function cleanMd(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanMd(p);
        // Remove empty dirs
        if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
      } else if (entry.name.endsWith('.md')) {
        fs.unlinkSync(p);
      }
    }
  }
  cleanMd(DEST);
}

const count = syncDir(SRC, DEST);

// Also copy root README.md (not in docs/, but useful for Console Guide agent)
const rootReadme = path.join(__dirname, '..', 'README.md');
if (fs.existsSync(rootReadme)) {
  fs.copyFileSync(rootReadme, path.join(DEST, 'README.md'));
  console.log(`  Synced ${count + 1} doc files → seed/copilot-console/docs/ (including README.md)`);
} else {
  console.log(`  Synced ${count} doc files → seed/copilot-console/docs/`);
}

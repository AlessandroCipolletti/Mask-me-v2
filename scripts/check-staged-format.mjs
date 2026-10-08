import { execFileSync } from 'node:child_process';
import * as prettier from 'prettier';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function checkStagedFormatting() {
  const paths = git([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
  ])
    .split('\0')
    .filter(Boolean);
  const unformatted = [];

  for (const path of paths) {
    const info = await prettier.getFileInfo(path, { ignorePath: '.gitignore' });
    if (info.ignored || !info.inferredParser) continue;

    const stagedContent = git(['show', `:${path}`]);
    const options = await prettier.resolveConfig(path);
    if (
      !(await prettier.check(stagedContent, { ...options, filepath: path }))
    ) {
      unformatted.push(path);
    }
  }

  if (unformatted.length > 0) {
    console.error('Staged files need Prettier formatting:');
    for (const path of unformatted) console.error(`  ${path}`);
    console.error('Run pnpm format, then stage the formatted files again.');
    process.exitCode = 1;
    return;
  }

  const noun = paths.length === 1 ? 'file' : 'files';
  console.info(`Prettier check passed for ${paths.length} staged ${noun}.`);
}

checkStagedFormatting().catch(() => {
  console.error('Unable to verify staged formatting. Commit blocked.');
  process.exitCode = 2;
});

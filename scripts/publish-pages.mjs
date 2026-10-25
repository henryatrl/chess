import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', input });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `${command} failed (${result.status})`);
  return result.stdout.trim();
}

try {
  const build = spawnSync('npm', ['run', 'build:standalone'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  // Read the remote before creating a commit; never force-push the publication branch.
  const remote = spawnSync('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/gh-pages'], { cwd: root, encoding: 'utf8' });
  if (remote.status !== 0 && remote.status !== 2) throw new Error(remote.stderr.trim() || 'Cannot read the publication branch');
  const parent = remote.status === 0 ? remote.stdout.trim().split(/\s+/)[0] : undefined;
  if (parent) run('git', ['fetch', 'origin', 'refs/heads/gh-pages']);

  const html = run('git', ['hash-object', '-w', '--stdin'], readFileSync(new URL('../dist-offline/index.html', import.meta.url), 'utf8'));
  const empty = run('git', ['hash-object', '-w', '--stdin'], '');
  const tree = run('git', ['mktree'], `100644 blob ${empty}\t.nojekyll\n100644 blob ${html}\tindex.html\n`);
  if (parent && run('git', ['rev-parse', `${parent}^{tree}`]) === tree) {
    console.log('The publication branch already contains this build.');
    process.exit(0);
  }
  const commit = run('git', ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Publish jane on GitHub Pages']);
  const push = spawnSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], { cwd: root, stdio: 'inherit' });
  if (push.status !== 0) process.exit(push.status ?? 1);
  console.log('Published the build to gh-pages. GitHub Pages must be enabled for this branch in repository settings.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

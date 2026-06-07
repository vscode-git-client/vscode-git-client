import type { WorkingTreeFileChange } from '../../types';
import { parseNameStatusZ } from '../gitParsing';
import type { GitServiceShape } from '.';

/**
 * Returns all files that differ between the working tree and the given ref.
 * Includes tracked files (via `git diff --name-status -z <ref>`) plus
 * untracked files (via `git ls-files --others --exclude-standard -z`).
 * When `scopePath` is provided, results are restricted to that subtree.
 * Results are sorted by path for stable output.
 */
export async function getFilesChangedBetweenWorkingTreeAndRef(
  this: GitServiceShape,
  ref: string,
  scopePath?: string
): Promise<WorkingTreeFileChange[]> {
  const scopeArgs = scopePath ? ['--', scopePath] : [];

  // Tracked changes
  const trackedResult = await this.runGit([
    'diff', '--name-status', '-z', ref, ...scopeArgs
  ]);
  const trackedEntries = parseNameStatusZ(trackedResult.stdout).map(
    (entry): WorkingTreeFileChange => ({ status: entry.status, path: entry.path, untracked: false })
  );

  // Untracked files
  const untrackedResult = await this.runGit([
    'ls-files', '--others', '--exclude-standard', '-z', ...scopeArgs
  ]);
  const untrackedEntries: WorkingTreeFileChange[] = untrackedResult.stdout
    .split('\0')
    .filter((p) => p.length > 0)
    .map((p): WorkingTreeFileChange => ({ status: 'A', path: p, untracked: true }));

  // Merge: prefer tracked entry when path appears in both
  const trackedPaths = new Set(trackedEntries.map((e) => e.path));
  const merged = [
    ...trackedEntries,
    ...untrackedEntries.filter((e) => !trackedPaths.has(e.path))
  ];

  // Stable sort by path
  merged.sort((a, b) => a.path.localeCompare(b.path));
  return merged;
}

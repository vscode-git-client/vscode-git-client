import type { GitServiceShape } from '.';

export async function stashFiles(
  this: GitServiceShape,
  paths: string[],
  message: string,
  options: { keepIndex: boolean; includeUntracked?: boolean }
): Promise<void> {
  const filtered = [...new Set(paths.map((value) => value.trim()).filter(Boolean))];
  if (filtered.length === 0) {
    return;
  }

  const args = ['stash', 'push', '-m', message];
  if (options.keepIndex) {
    args.push('--keep-index');
  }
  if (options.includeUntracked) {
    args.push('--include-untracked');
  }
  args.push('--', ...filtered);
  await this.runGit(args);
}

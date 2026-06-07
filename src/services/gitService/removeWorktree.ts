import type { GitServiceShape } from '.';

export async function removeWorktree(this: GitServiceShape, worktreePath: string, force = false): Promise<void> {
  const args = ['worktree', 'remove', worktreePath];
  if (force) { args.push('--force'); }
  await this.runGit(args);
}

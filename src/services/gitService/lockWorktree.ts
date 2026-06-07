import type { GitServiceShape } from '.';

export async function lockWorktree(this: GitServiceShape, worktreePath: string, reason?: string): Promise<void> {
  const args = ['worktree', 'lock', worktreePath];
  if (reason) { args.push('--reason', reason); }
  await this.runGit(args);
}

import type { GitServiceShape } from '.';

export async function addWorktreeBranch(
  this: GitServiceShape,
  worktreePath: string,
  branch: string,
  base?: string
): Promise<void> {
  const args = ['worktree', 'add', '-b', branch, worktreePath];
  if (base) { args.push(base); }
  await this.runGit(args);
}

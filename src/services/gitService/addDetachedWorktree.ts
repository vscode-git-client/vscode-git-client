import type { GitServiceShape } from '.';

export async function addDetachedWorktree(
  this: GitServiceShape,
  worktreePath: string,
  ref: string
): Promise<void> {
  await this.runGit(['worktree', 'add', '--detach', worktreePath, ref]);
}

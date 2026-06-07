import type { GitServiceShape } from '.';

export async function addWorktree(this: GitServiceShape, worktreePath: string, ref: string): Promise<void> {
  await this.runGit(['worktree', 'add', worktreePath, ref]);
}

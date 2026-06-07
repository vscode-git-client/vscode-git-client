import type { GitServiceShape } from '.';

export async function unlockWorktree(this: GitServiceShape, worktreePath: string): Promise<void> {
  await this.runGit(['worktree', 'unlock', worktreePath]);
}

import type { GitServiceShape } from '.';

export async function pruneWorktrees(this: GitServiceShape): Promise<void> {
  await this.runGit(['worktree', 'prune']);
}

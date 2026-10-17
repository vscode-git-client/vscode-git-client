import type { CommandController } from './index';
import { WorktreeTreeItem } from '../../providers/worktreeTreeProvider';

export async function handleWorktreeCompareWithCurrent(
  this: CommandController,
  arg?: unknown
): Promise<void> {
  const item = arg instanceof WorktreeTreeItem ? arg : undefined;
  if (!item) {
    return;
  }

  const worktree = item.worktree;

  if (worktree.isCurrent) {
    return;
  }

  const worktreeBranch = worktree.branch;
  if (!worktreeBranch) {
    return;
  }

  const currentBranch = await this.git.getCurrentBranch();
  await this.editor.openBranchCompare(currentBranch, worktreeBranch);
}

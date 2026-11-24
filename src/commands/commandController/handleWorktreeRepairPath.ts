import type { CommandController } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorktreeTreeItem } from '../../providers/worktreeTreeProvider';

/**
 * Lets the user point a worktree at its new folder after moving it on disk,
 * then runs `git worktree repair` to update the link stored in the main repository.
 */
export async function handleWorktreeRepairPath(this: CommandController, arg?: unknown): Promise<void> {
  const item = arg instanceof WorktreeTreeItem ? arg : undefined;
  if (!item) {
    return;
  }
  const { worktree } = item;

  if (worktree.isCurrent) {
    void vscode.window.showWarningMessage('The current worktree cannot be re-linked from itself.');
    return;
  }

  const picked = await vscode.window.showOpenDialog({
    title: `New location of worktree "${path.basename(worktree.worktreePath)}"`,
    openLabel: 'Update Worktree Path',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(closestExistingDirectory(worktree.worktreePath))
  });
  const newPath = picked?.[0]?.fsPath;
  if (!newPath) {
    return;
  }

  if (path.resolve(newPath) === path.resolve(worktree.worktreePath) && !worktree.isPrunable) {
    void vscode.window.showInformationMessage('The worktree path is already up to date.');
    return;
  }

  await this.git.repairWorktree(newPath);
  await this.state.refreshWorktrees();
  void vscode.window.showInformationMessage(`Worktree path updated to ${newPath}.`);
}

function closestExistingDirectory(target: string): string {
  let dir = path.dirname(target);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return dir;
}

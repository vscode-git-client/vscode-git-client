import * as vscode from 'vscode';
import { Logger } from './logger';
import { StateStore } from './state/stateStore';

const WORKTREE_VIEW_ID = 'vscodeGitClient.worktrees';
const SUBMODULE_VIEW_ID = 'vscodeGitClient.submodules';

export function attachSparseRepositoryViewAutoCollapse(
  context: vscode.ExtensionContext,
  stateStore: StateStore,
  logger: Logger
): void {
  let collapsedForSparseState = false;

  const update = (): void => {
    if (!stateStore.worktreesLoaded || !stateStore.submodulesLoaded) {
      return;
    }

    const shouldCollapse =
      stateStore.worktrees.length === 1 &&
      stateStore.worktrees[0].isCurrent &&
      stateStore.submodules.length === 0;

    if (!shouldCollapse) {
      collapsedForSparseState = false;
      return;
    }
    if (collapsedForSparseState) {
      return;
    }

    collapsedForSparseState = true;
    void collapseTreeView(WORKTREE_VIEW_ID, logger);
    void collapseTreeView(SUBMODULE_VIEW_ID, logger);
  };

  context.subscriptions.push(stateStore.onDidChange(update));
  update();
}

async function collapseTreeView(viewId: string, logger: Pick<Logger, 'warn'>): Promise<void> {
  try {
    await vscode.commands.executeCommand(`workbench.actions.treeView.${viewId}.collapseAll`);
  } catch (error) {
    logger.warn(`Failed to auto-collapse ${viewId}: ${String(error)}`);
  }
}

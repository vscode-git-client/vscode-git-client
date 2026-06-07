import * as vscode from 'vscode';
import { classifyMergeIssue, classifyRebaseIssue } from './classifyIssues';
import type { CommandControllerShape } from './shape';

export async function openOperationConflictEditors(
  this: CommandControllerShape,
  operation: 'cherry-pick' | 'merge' | 'rebase'
): Promise<void> {
  const conflicts = this.state.conflicts.length > 0
    ? this.state.conflicts
    : await this.git.getMergeConflicts();
  if (conflicts.length === 0) {
    await vscode.commands.executeCommand('workbench.view.scm');
    return;
  }

  let openedCount = 0;
  for (const conflict of conflicts) {
    try {
      await this.editor.openMergeConflict(conflict.path);
      openedCount += 1;
    } catch (error) {
      this.logger.warn(`Failed to open merge editor for ${operation} conflict file ${conflict.path}: ${String(error)}`);
    }
  }

  if (openedCount < conflicts.length) {
    await vscode.commands.executeCommand('workbench.view.scm');
  }
}

export async function handleRebaseConflict(this: CommandControllerShape): Promise<void> {
  void vscode.window.showWarningMessage('There are some conflicts. You have to resolve them first.');
  await openOperationConflictEditors.call(this, 'rebase');
}

export async function handleOperationConflict(
  this: CommandControllerShape,
  operation: 'cherry-pick' | 'merge' | 'rebase',
  refreshPromise: Promise<void> = Promise.resolve()
): Promise<void> {
  void vscode.window.showWarningMessage('There are some conflicts. You have to resolve them first.');
  await refreshPromise;
  await openOperationConflictEditors.call(this, operation);
}

export async function showRebaseProgressFeedback(this: CommandControllerShape): Promise<void> {
  const state = this.state.operationState;
  if (state.kind !== 'rebase') {
    void vscode.window.showInformationMessage('Rebase completed successfully.');
    return;
  }

  const progress = state.stepCurrent && state.stepTotal
    ? ` (${state.stepCurrent}/${state.stepTotal})`
    : '';
  const conflicts = this.state.conflicts.length > 0
    ? this.state.conflicts
    : await this.git.getMergeConflicts();
  if (conflicts.length > 0) {
    await handleRebaseConflict.call(this);
    return;
  }

  void vscode.window.showInformationMessage(
    `Rebase is still in progress${progress}. Continue to process remaining commits or Abort.`
  );
}

export async function startMergeOperation(
  this: CommandControllerShape,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const issue = classifyMergeIssue(error);
    if (issue.kind === 'conflict') {
      await handleOperationConflict.call(this, 'merge', this.state.refreshAll());
      return;
    }
    throw error;
  }

  await this.state.refreshAll();
}

export async function startRebaseOperation(
  this: CommandControllerShape,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const issue = classifyRebaseIssue(error);
    if (issue.kind === 'conflict') {
      await handleOperationConflict.call(this, 'rebase', this.state.refreshAll());
      return;
    }
    throw error;
  }

  await this.state.refreshAll();
  await showRebaseProgressFeedback.call(this);
}

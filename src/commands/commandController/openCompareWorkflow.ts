import type { CommandController } from '.';
import * as vscode from 'vscode';
import { pickRevisionToCompare } from '../../views/revisionPicker';

export async function openCompareWorkflow(this: CommandController): Promise<void> {
  const currentBranch = await this.git.getCurrentBranch();

  const left = await vscode.window.showQuickPick(
    [
      {
        label: currentBranch,
        description: 'current branch',
        index: 0
      },
      { label: 'Choose another revision…', index: 1 }
    ],
    { title: 'Compare branches — left side', placeHolder: 'Default: current branch' }
  );
  if (!left) {
    return;
  }

  let leftRef = currentBranch;
  if (left.index === 1) {
    const leftSelection = await pickRevisionToCompare(
      this.git,
      () => this.state.branches,
      () => this.state.tags,
      () => this.state.refreshBranches(),
      { title: 'Compare branches — left side', allowTypedRevision: true }
    );
    if (!leftSelection) {
      return;
    }
    leftRef = leftSelection.ref;
  }

  const rightSelection = await pickRevisionToCompare(
    this.git,
    () => this.state.branches,
    () => this.state.tags,
    () => this.state.refreshBranches(),
    { title: `Compare against ${leftRef}`, allowTypedRevision: true }
  );
  if (!rightSelection) {
    return;
  }

  await this.editor.openBranchCompare(leftRef, rightSelection.ref);
}

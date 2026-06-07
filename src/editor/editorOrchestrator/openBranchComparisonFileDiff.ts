import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openBranchComparisonFileDiff(
  this: EditorOrchestratorShape,
  leftRef: string,
  rightRef: string
): Promise<void> {
  const files = await this.git.getFilesChangedBetween(leftRef, rightRef);
  const choice = await vscode.window.showQuickPick(files, {
    title: `Files changed between ${leftRef} and ${rightRef}`,
    placeHolder: 'Pick a file to open diff'
  });

  if (!choice) {
    return;
  }

  await this.openDiffForFile({
    path: choice,
    leftRef,
    rightRef,
    title: `${leftRef} ↔ ${rightRef} · ${choice}`
  });
}

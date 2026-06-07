import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openCommitFilesDiff(
  this: EditorOrchestratorShape,
  sha: string
): Promise<void> {
  const files = await this.git.getFilesInCommit(sha);
  const choice = await vscode.window.showQuickPick(files, {
    title: `Commit ${sha.slice(0, 8)} files`,
    placeHolder: 'Pick a file to diff against parent'
  });

  if (!choice) {
    return;
  }

  await this.openDiffForFile({
    path: choice,
    leftRef: `${sha}^`,
    rightRef: sha,
    title: `${sha.slice(0, 8)} parent ↔ commit · ${choice}`
  });
}

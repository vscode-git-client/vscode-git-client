import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openCompareWithRevisionForFolder(
  this: EditorOrchestratorShape,
  folderRelPath: string,
  ref: string,
  refLabel: string
): Promise<void> {
  const scopeForGit = folderRelPath || undefined;
  const scopeForView = folderRelPath || '.';
  const files = await this.git.getFilesChangedBetweenWorkingTreeAndRef(ref, scopeForGit);
  if (files.length === 0) {
    void vscode.window.showInformationMessage(
      `No differences in ${scopeForView} against ${refLabel}.`
    );
    return;
  }

  await this.commitFilesView.showWorkingTreeComparison({
    ref,
    refLabel,
    scopePath: scopeForView,
    files
  });

  const first = files[0];
  await this.openWorkingTreeFileDiff(first.path, ref, refLabel, {
    preview: true,
    status: first.status
  });
}

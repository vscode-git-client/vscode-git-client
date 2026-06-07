import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import { EMPTY_TREE_SHA } from './utils';

export async function openCommitRangeDetails(
  this: EditorOrchestratorShape,
  rawShas: readonly string[]
): Promise<void> {
  const orderedShas = Array.from(
    new Set(
      rawShas
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
  if (orderedShas.length < 2) {
    return;
  }

  const newestSha = orderedShas[0]!;
  const oldestSha = orderedShas[orderedShas.length - 1]!;
  const oldestParent = await this.git.getParentCommit(oldestSha);
  const fromRef = oldestParent ? `${oldestSha}^` : EMPTY_TREE_SHA;
  const toRef = newestSha;
  const fromLabel = oldestParent ? `${oldestSha.slice(0, 8)}^` : 'root';
  const toLabel = newestSha.slice(0, 8);
  const files = await this.git.getFilesChangedBetweenRefsWithStatus(fromRef, toRef);

  await this.commitFilesView.showCommitRange({
    fromRef,
    toRef,
    fromLabel,
    toLabel,
    files
  });
  if (files.length === 0) {
    void vscode.window.showInformationMessage('Selected commit range has no net file changes.');
  }
}

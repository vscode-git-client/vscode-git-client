import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import { formatComparableSideLabel } from './utils';

export async function swapActiveCompareDirection(
  this: EditorOrchestratorShape
): Promise<void> {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = activeTab?.input;
  if (!(input instanceof vscode.TabInputTextDiff)) {
    void vscode.window.showInformationMessage(
      'Open a VS Code Git Client diff tab to swap compare direction.'
    );
    return;
  }

  const left = await this.parseComparableDiffSide(input.original);
  const right = await this.parseComparableDiffSide(input.modified);
  if (!left || !right) {
    void vscode.window.showInformationMessage(
      'This diff tab was not opened by VS Code Git Client.'
    );
    return;
  }

  if (left.relativePath !== right.relativePath) {
    void vscode.window.showInformationMessage(
      'Cannot swap diff direction for sides that point at different files.'
    );
    return;
  }

  const leftUri = await this.createComparableDiffUri(right);
  const rightUri = await this.createComparableDiffUri(left);
  const title = `${formatComparableSideLabel(right)} ↔ ${formatComparableSideLabel(left)} · ${left.relativePath}`;
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: false,
    preserveFocus: false
  });
}

import * as path from 'path';
import * as vscode from 'vscode';
import { TextSource } from './textCompareSource';

export interface SourceQuickPickItem extends vscode.QuickPickItem {
  sourceKind: 'file' | 'clipboard' | 'empty';
}

export function buildSourcePickerItems(): SourceQuickPickItem[] {
  return [
    { sourceKind: 'file', label: '$(file) Open file...', description: 'Choose a workspace file' },
    { sourceKind: 'clipboard', label: '$(clippy) Paste from Clipboard', description: 'Use current clipboard text' },
    { sourceKind: 'empty', label: '$(circle-outline) Empty text', description: 'Start with an empty buffer' }
  ];
}

export async function pickTextCompareSource(sideLabel: string): Promise<TextSource | undefined> {
  const choice = await vscode.window.showQuickPick<SourceQuickPickItem>(buildSourcePickerItems(), {
    title: `Select ${sideLabel} source`,
    placeHolder: 'Choose a source for the comparison',
    ignoreFocusOut: true
  });

  if (!choice) {
    return undefined;
  }

  if (choice.sourceKind === 'file') {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceRoot;
    const files = await vscode.window.showOpenDialog({
      title: `Open file for ${sideLabel}`,
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri
    });

    if (!files || files.length === 0) {
      return undefined;
    }

    const uri = files[0];
    let content: string;
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      content = document.getText();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file: ${message}`);
    }

    const fileName = path.basename(uri.fsPath);
    return { kind: 'file', uri, content, label: fileName };
  }

  if (choice.sourceKind === 'clipboard') {
    const content = await vscode.env.clipboard.readText();
    return { kind: 'clipboard', content, label: 'Clipboard' };
  }

  return { kind: 'empty', content: '', label: 'Empty' };
}

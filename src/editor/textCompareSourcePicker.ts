import * as vscode from 'vscode';
import { TextSource } from './textCompareSource';

export function buildSourcePickerItems(): vscode.QuickPickItem[] {
  return [
    { label: '$(file) Open file...', description: 'Choose a workspace file' },
    { label: '$(clippy) Paste from Clipboard', description: 'Use current clipboard text' },
    { label: '$(empty) Empty text', description: 'Start with an empty buffer' }
  ];
}

export async function pickTextCompareSource(sideLabel: string): Promise<TextSource | undefined> {
  const choice = await vscode.window.showQuickPick(buildSourcePickerItems(), {
    title: `Select ${sideLabel} source`,
    placeHolder: 'Choose a source for the comparison'
  });

  if (!choice) {
    return undefined;
  }

  if (choice.label === '$(file) Open file...') {
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
      const bytes = await vscode.workspace.fs.readFile(uri);
      content = Buffer.from(bytes).toString('utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file: ${message}`);
    }

    const fileName = uri.path.split('/').pop() || uri.fsPath;
    return { kind: 'file', uri, content, label: fileName };
  }

  if (choice.label === '$(clippy) Paste from Clipboard') {
    const content = await vscode.env.clipboard.readText();
    return { kind: 'clipboard', content, label: 'Clipboard' };
  }

  return { kind: 'empty', content: '', label: 'Empty' };
}

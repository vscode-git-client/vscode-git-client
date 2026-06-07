import * as vscode from 'vscode';

export async function openDiffForUri(uri: vscode.Uri, title: string): Promise<void> {
  await vscode.commands.executeCommand(
    'vscode.diff',
    uri.with({ query: 'left' }),
    uri.with({ query: 'right' }),
    title,
    { preview: false, preserveFocus: false }
  );
}

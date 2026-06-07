import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openFileAtRevision(
  this: EditorOrchestratorShape,
  ref: string,
  filePath: string
): Promise<void> {
  const uri = await this.createVirtualUri(ref, filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: true,
    viewColumn: vscode.ViewColumn.Beside
  });
}

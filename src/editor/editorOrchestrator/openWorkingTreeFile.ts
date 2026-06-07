import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openWorkingTreeFile(
  this: EditorOrchestratorShape,
  filePath: string
): Promise<void> {
  const gitRoot = await this.git.getGitRoot();
  const uri = vscode.Uri.file(path.join(gitRoot, filePath));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
}

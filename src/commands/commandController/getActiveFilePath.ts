import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export function getActiveFilePath(this: CommandControllerShape): string | undefined {
  const editor = vscode.window.activeTextEditor;
  const uri = editor?.document.uri;
  if (!uri || uri.scheme !== 'file') {
    return undefined;
  }

  return this.git.toRepoRelative(uri.fsPath);
}

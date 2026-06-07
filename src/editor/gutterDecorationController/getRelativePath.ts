import * as vscode from 'vscode';
import type { GutterDecorationControllerShape } from './index';

export function getRelativePath(this: GutterDecorationControllerShape, uri: vscode.Uri): string | undefined {
  return this.gitService.toRepoRelative(uri.fsPath);
}

import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export async function pickFileFromWorkspace(
  this: CommandControllerShape,
  title: string
): Promise<string | undefined> {
  const files = await vscode.workspace.findFiles('**/*', '**/.git/**', 500);
  const picked = await vscode.window.showQuickPick(
    files
      .map((uri) => this.git.toRepoRelative(uri.fsPath))
      .filter((rel): rel is string => Boolean(rel))
      .map((label) => ({ label })),
    {
      title,
      matchOnDescription: true
    }
  );

  return picked?.label;
}

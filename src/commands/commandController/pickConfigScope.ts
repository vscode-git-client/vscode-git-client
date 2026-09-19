import * as vscode from 'vscode';
import type { GitConfigScope } from '../../services/gitService/gitConfig';

/** Shared scope chooser for repository config quick edits. */
export async function pickConfigScope(title: string): Promise<GitConfigScope | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'This repository only', description: '--local', scope: 'local' as const },
      { label: 'All repositories', description: '--global', scope: 'global' as const }
    ],
    { title, placeHolder: 'Where should this setting be saved?' }
  );
  return picked?.scope;
}

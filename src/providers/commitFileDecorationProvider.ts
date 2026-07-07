import * as vscode from 'vscode';
import { CommitFilesTreeProvider } from './commitFilesTreeProvider';

export class CommitFileDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.emitter.event;

  private readonly statuses = new Map<string, string>();

  constructor(private readonly commitFilesProvider: CommitFilesTreeProvider) {
    this.commitFilesProvider.onDidChangeTreeData(() => {
      this.statuses.clear();
      for (const item of this.commitFilesProvider.getAllFileItems()) {
        this.statuses.set(item.resourceUri?.toString() ?? '', normalizeStatus(item.status));
      }
      this.emitter.fire(undefined);
    });
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    const status = this.statuses.get(uri.toString());
    if (!status) {
      return;
    }

    if (status === 'A') {
      return {
        badge: 'U',
        color: new vscode.ThemeColor('gitDecoration.untrackedResourceForeground'),
        tooltip: 'Untracked'
      };
    }
    if (status === 'M') {
      return {
        badge: 'M',
        color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
        tooltip: 'Modified'
      };
    }
    if (status === 'D') {
      return {
        badge: 'D',
        color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
        tooltip: 'Deleted'
      };
    }

    return undefined;
  }

  dispose(): void {
    this.emitter.dispose();
    this.statuses.clear();
  }
}

function normalizeStatus(statusRaw: string): string {
  const token = (statusRaw ?? '').trim();
  if (!token) return '?';
  return token[0].toUpperCase();
}

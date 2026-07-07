import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { StateStore } from '../state/stateStore';

export class StashDocumentDropEditProvider implements vscode.DocumentDropEditProvider {
  constructor(
    private readonly git: GitService,
    private readonly state: StateStore
  ) {}

  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    const stashItem = dataTransfer.get('application/vnd.code.tree.vscodegitclient.stashes');
    if (stashItem) {
      const items = Array.isArray(stashItem.value) ? stashItem.value : [stashItem.value];
      const item = items[0];
      if (item && item.stash) {
        try {
          await this.git.applyStash(item.stash.ref, false);
          await this.state.refreshAll();
          return new vscode.DocumentDropEdit('');
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to unstash: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
    return undefined;
  }
}

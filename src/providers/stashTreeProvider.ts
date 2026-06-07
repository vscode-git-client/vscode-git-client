import * as vscode from 'vscode';
import { StateStore } from '../state/stateStore';
import { StashEntry } from '../types';
import { CommandId } from '../commands/commandController/commandIds';

export class StashTreeItem extends vscode.TreeItem {
  constructor(public readonly stash: StashEntry) {
    super(stash.ref, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'stashEntry';
    this.id = `stash:${stash.ref}`;
    this.description = stash.fileCount === undefined
      ? stash.message
      : `${stash.message} · files ${stash.fileCount}`;
    this.tooltip = `${stash.ref}\n${stash.message}${stash.author ? `\nauthor: ${stash.author}` : ''}`;
    this.iconPath = new vscode.ThemeIcon('archive');

    this.command = {
      title: 'Preview Stash Patch',
      command: CommandId.StashPreviewPatch,
      arguments: [this]
    };
  }
}

export class StashTreeProvider implements vscode.TreeDataProvider<StashTreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly state: StateStore) {
    this.state.onDidChange(() => this.emitter.fire());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: StashTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<StashTreeItem[]> {
    return this.state.stashes.map((stash) => new StashTreeItem(stash));
  }

  findByRef(ref: string): StashEntry | undefined {
    return this.state.stashes.find((stash) => stash.ref === ref);
  }
}

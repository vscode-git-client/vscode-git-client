import * as vscode from 'vscode';
import { StateStore } from '../state/stateStore';
import { StashEntry, WorkingTreeChange } from '../types';
import { GitService } from '../services/gitService';

export class StashTreeItem extends vscode.TreeItem {
  constructor(public readonly stash: StashEntry) {
    super(stash.ref, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'stashEntry';
    this.id = `stash:${stash.ref}`;
    this.description =
      stash.fileCount === undefined ? stash.message : `${stash.message} · files ${stash.fileCount}`;
    this.tooltip = `${stash.ref}\n${stash.message}${stash.author ? `\nauthor: ${stash.author}` : ''}`;
    this.iconPath = new vscode.ThemeIcon('archive');

    this.command = {
      title: 'Preview Stash Patch',
      command: 'vscodeGitClient.stash.previewPatch',
      arguments: [this]
    };
  }
}

export class StashTreeDragAndDropController implements vscode.TreeDragAndDropController<StashTreeItem> {
  dropMimeTypes: string[] = [
    'application/vnd.code.tree.vscodegitclient.stashes',
    'text/uri-list',
    'application/vnd.code.tree.scmgit.scm',
    'application/vnd.code.tree.scmResourceState',
    'application/vnd.code.tree.git.scmgit.scm',
    'application/vnd.code.tree.gitResource'
  ];
  dragMimeTypes: string[] = ['text/plain', 'application/vnd.code.tree.vscodegitclient.stashes'];

  constructor(
    private readonly git: GitService,
    private readonly state: StateStore
  ) {}

  async handleDrop(
    target: StashTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const stashItem = dataTransfer.get('application/vnd.code.tree.vscodegitclient.stashes');
    if (stashItem) {
      // Log the type of the value to debug what VS Code passes
      console.log('stashItem.value:', stashItem.value);
      const items = Array.isArray(stashItem.value) ? stashItem.value : [stashItem.value];
      const item = items[0] as StashTreeItem;
      if (item && item.stash) {
        try {
          await this.git.applyStash(item.stash.ref, false);
          await this.state.refreshAll();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to unstash: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        return;
      }
    }

    const paths: string[] = [];

    const uriList = dataTransfer.get('text/uri-list');
    if (uriList) {
      const uris = (await uriList.asString())
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0 && !line.startsWith('#'));
      for (const uriString of uris) {
        try {
          const uri = vscode.Uri.parse(uriString);
          if (uri.scheme === 'file') {
            paths.push(uri.fsPath);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (paths.length === 0) {
      // Try parsing JSON payloads from other SCM mimetypes
      for (const [mime, item] of dataTransfer) {
        if (mime === 'text/uri-list') continue;
        const str = await item.asString();
        try {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) {
            for (const el of parsed) {
              if (el && typeof el === 'object' && el.resourceUri) {
                const uri = vscode.Uri.parse(el.resourceUri.external || el.resourceUri.path);
                if (uri.scheme === 'file') {
                  paths.push(uri.fsPath);
                } else if (el.resourceUri.fsPath) {
                  paths.push(el.resourceUri.fsPath);
                }
              } else if (el && typeof el === 'string') {
                const uri = vscode.Uri.parse(el);
                if (uri.scheme === 'file') paths.push(uri.fsPath);
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (paths.length === 0) {
      vscode.window.showInformationMessage('No valid files were dropped to stash.');
      return;
    }

    const message = await vscode.window.showInputBox({
      prompt: `Enter stash message for ${paths.length} file(s)`,
      placeHolder: 'Stash message (optional)'
    });

    if (message === undefined) {
      return; // Canceled
    }

    try {
      const changes = await this.git.getChangedFiles();
      let includeUntracked = false;

      for (const p of paths) {
        const match = changes.find((c: WorkingTreeChange) => c.path === p || p.endsWith(c.path));
        if (match && match.status.trim() === '??') {
          includeUntracked = true;
          break;
        }
      }

      await this.git.stashFiles(paths, message, {
        keepIndex: true,
        includeUntracked
      });
      await this.state.refreshAll();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to stash files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async handleDrag(
    source: readonly StashTreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (source.length > 0) {
      dataTransfer.set(
        'text/plain',
        new vscode.DataTransferItem(`git stash apply ${source[0].stash.ref}`)
      );
      dataTransfer.set(
        'application/vnd.code.tree.vscodegitclient.stashes',
        new vscode.DataTransferItem(source)
      );
    }
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

import * as vscode from 'vscode';
import { TextSource, getLanguageForFile } from './textCompareSource';

export function formatTextCompareTitle(leftLabel: string, rightLabel: string): string {
  return `${leftLabel} ↔ ${rightLabel} · Text Compare`;
}

export class TextCompareSession implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private leftUri: vscode.Uri | undefined;
  private rightUri: vscode.Uri | undefined;
  private disposed = false;

  private constructor() { }

  static async create(left: TextSource, right: TextSource): Promise<TextCompareSession> {
    const session = new TextCompareSession();
    await session.open(left, right);
    return session;
  }

  private async open(left: TextSource, right: TextSource): Promise<void> {
    try {
      const leftDoc = await createUntitledDocument(left);
      this.leftUri = leftDoc.uri;

      const rightDoc = await createUntitledDocument(right);
      this.rightUri = rightDoc.uri;

      const title = formatTextCompareTitle(left.label, right.label);
      await vscode.commands.executeCommand('vscode.diff', this.leftUri, this.rightUri, title, {
        preview: false,
        preserveFocus: false
      });

      this.disposables.push(
        vscode.window.tabGroups.onDidChangeTabs(() => {
          void this.disposeIfHidden();
        })
      );

      await this.disposeIfHidden();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private async disposeIfHidden(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const visibleUris = collectVisibleTabUris();
    const leftVisible = this.leftUri ? visibleUris.has(this.leftUri.toString()) : false;
    const rightVisible = this.rightUri ? visibleUris.has(this.rightUri.toString()) : false;

    if (!leftVisible && !rightVisible) {
      this.dispose();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;

    const leftUri = this.leftUri;
    const rightUri = this.rightUri;
    this.leftUri = undefined;
    this.rightUri = undefined;

    void closeDocument(leftUri);
    void closeDocument(rightUri);
  }

  async close(): Promise<void> {
    this.dispose();
  }
}

async function createUntitledDocument(source: TextSource): Promise<vscode.TextDocument> {
  const language = source.kind === 'file' ? getLanguageForFile(source.uri) : undefined;
  return vscode.workspace.openTextDocument({
    content: source.content,
    language
  });
}

function collectVisibleTabUris(): Set<string> {
  const uris = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText) {
        uris.add(input.uri.toString());
      } else if (input instanceof vscode.TabInputTextDiff) {
        uris.add(input.original.toString());
        uris.add(input.modified.toString());
      }
    }
  }
  return uris;
}

async function closeDocument(uri: vscode.Uri | undefined): Promise<void> {
  if (!uri) {
    return;
  }

  const tab = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find((t) => {
      const input = t.input;
      if (input instanceof vscode.TabInputText) {
        return input.uri.toString() === uri.toString();
      }
      return false;
    });

  if (tab) {
    await vscode.window.tabGroups.close(tab, true);
    return;
  }

  const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
  if (!document) {
    return;
  }

  const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
  if (editor) {
    if (vscode.window.activeTextEditor?.document.uri.toString() !== uri.toString()) {
      await vscode.window.showTextDocument(document, { preserveFocus: false });
    }
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}

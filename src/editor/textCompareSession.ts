import * as vscode from 'vscode';
import { TextSource, getLanguageForFile } from './textCompareSource';

export function formatTextCompareTitle(leftLabel: string, rightLabel: string): string {
  return `${leftLabel} ↔ ${rightLabel} · Text Compare`;
}

export class TextCompareSession implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private leftUri: vscode.Uri | undefined;
  private rightUri: vscode.Uri | undefined;

  private constructor() { }

  static async create(left: TextSource, right: TextSource): Promise<TextCompareSession> {
    const session = new TextCompareSession();
    await session.open(left, right);
    return session;
  }

  private async open(left: TextSource, right: TextSource): Promise<void> {
    this.leftUri = await createUntitledUri(left);
    this.rightUri = await createUntitledUri(right);

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

    // If the diff tab was already closed before the listener attached, clean up immediately.
    await this.disposeIfHidden();
  }

  private async disposeIfHidden(): Promise<void> {
    if (!this.leftUri || !this.rightUri) {
      this.dispose();
      return;
    }

    const visibleUris = collectVisibleTabUris();
    const leftVisible = visibleUris.has(this.leftUri.toString());
    const rightVisible = visibleUris.has(this.rightUri.toString());

    if (!leftVisible && !rightVisible) {
      await closeDocument(this.leftUri);
      await closeDocument(this.rightUri);
      this.dispose();
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

async function createUntitledUri(source: TextSource): Promise<vscode.Uri> {
  const language = source.kind === 'file' ? getLanguageForFile(source.uri) : undefined;
  const document = await vscode.workspace.openTextDocument({
    content: source.content,
    language
  });
  return document.uri;
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

async function closeDocument(uri: vscode.Uri): Promise<void> {
  const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
  if (!document) {
    return;
  }

  // Prefer closing the editor tab over closing the document directly.
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

  // Fallback: close the document via command if no tab is open.
  const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
  if (editor) {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}

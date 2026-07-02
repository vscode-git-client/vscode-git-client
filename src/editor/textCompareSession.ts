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
    let leftDoc: vscode.TextDocument;
    let rightDoc: vscode.TextDocument;
    try {
      leftDoc = await vscode.workspace.openTextDocument({
        content: left.content,
        language: left.kind === 'file' ? getLanguageForFile(left.uri) : undefined
      });
      rightDoc = await vscode.workspace.openTextDocument({
        content: right.content,
        language: right.kind === 'file' ? getLanguageForFile(right.uri) : undefined
      });
    } catch (error) {
      await this.dispose();
      throw error;
    }

    this.leftUri = leftDoc.uri;
    this.rightUri = rightDoc.uri;

    const title = formatTextCompareTitle(left.label, right.label);
    await vscode.commands.executeCommand('vscode.diff', this.leftUri, this.rightUri, title, {
      preview: false,
      preserveFocus: false
    });

    const diffTab = findDiffTab(this.leftUri, this.rightUri);

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        void this.disposeIfHidden(diffTab);
      })
    );

    // If the diff tab was already closed before the listener attached, clean up immediately.
    await this.disposeIfHidden(diffTab);
  }

  private async disposeIfHidden(diffTab?: vscode.Tab): Promise<void> {
    if (this.disposed) {
      return;
    }

    const leftStillVisible = this.leftUri ? isUriVisible(this.leftUri) : false;
    const rightStillVisible = this.rightUri ? isUriVisible(this.rightUri) : false;

    if (!leftStillVisible && !rightStillVisible) {
      if (diffTab && diffTab.input instanceof vscode.TabInputTextDiff) {
        await vscode.window.tabGroups.close(diffTab, true);
      }
      await this.dispose();
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;

    await closeDocument(this.leftUri);
    await closeDocument(this.rightUri);
  }
}

function isUriVisible(uri: vscode.Uri): boolean {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText && input.uri.toString() === uri.toString()) {
        return true;
      }
      if (input instanceof vscode.TabInputTextDiff) {
        if (input.original.toString() === uri.toString() || input.modified.toString() === uri.toString()) {
          return true;
        }
      }
    }
  }
  return false;
}

function findDiffTab(leftUri: vscode.Uri, rightUri: vscode.Uri): vscode.Tab | undefined {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputTextDiff) {
        const originalMatch = input.original.toString() === leftUri.toString();
        const modifiedMatch = input.modified.toString() === rightUri.toString();
        if (originalMatch && modifiedMatch) {
          return tab;
        }
      }
    }
  }
  return undefined;
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

import * as vscode from 'vscode';
import * as path from 'path';
import { TextSource } from './textCompareSource';
import { pickTextCompareSource } from './textCompareSourcePicker';
import { TextCompareSession } from './textCompareSession';

export interface TextCompareOptions {
  seedFile?: vscode.Uri;
  seedSide?: 'left' | 'right';
}

export class TextCompareOrchestrator {
  private activeSession: TextCompareSession | undefined;

  async open(options: TextCompareOptions = {}): Promise<void> {
    const seedSide = options.seedSide ?? 'left';
    const seed = options.seedFile ? await buildFileSource(options.seedFile) : undefined;

    const left = seedSide === 'left' && seed ? seed : await pickTextCompareSource('Left');
    if (!left) {
      return;
    }

    const right = seedSide === 'right' && seed ? seed : await pickTextCompareSource('Right');
    if (!right) {
      return;
    }

    this.activeSession?.dispose();
    this.activeSession = await TextCompareSession.create(left, right);
  }

  dispose(): void {
    this.activeSession?.dispose();
  }
}

export function buildPickOrder(seedSide?: 'left' | 'right'): Array<'left' | 'right'> {
  if (seedSide === 'left') {
    return ['right'];
  }
  if (seedSide === 'right') {
    return ['left'];
  }
  return ['left', 'right'];
}

async function buildFileSource(uri: vscode.Uri): Promise<TextSource> {
  const document = await vscode.workspace.openTextDocument(uri);
  const content = document.getText();
  const fileName = path.basename(uri.fsPath);
  return { kind: 'file', uri, content, label: fileName };
}

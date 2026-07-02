import * as path from 'path';
import * as vscode from 'vscode';
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
    const seed = options.seedFile ? await buildFileSource(options.seedFile) : undefined;
    const seedSide = seed ? (options.seedSide ?? 'left') : undefined;

    const sources: Partial<Record<'left' | 'right', TextSource>> = {};
    if (seedSide && seed) {
      sources[seedSide] = seed;
    }

    for (const side of buildPickOrder(seedSide)) {
      const picked = await pickTextCompareSource(side === 'left' ? 'Left' : 'Right');
      if (!picked) {
        return;
      }
      sources[side] = picked;
    }

    const left = sources.left;
    const right = sources.right;
    if (!left || !right) {
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

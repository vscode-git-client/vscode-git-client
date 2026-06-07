import * as vscode from 'vscode';
import { computeLineHunks } from '../lineDiff';
import type { GutterDecorationControllerShape } from './index';

export async function update(this: GutterDecorationControllerShape, editor: vscode.TextEditor): Promise<void> {
  const updateVersion = (this.updateVersions.get(editor) ?? 0) + 1;
  this.updateVersions.set(editor, updateVersion);

  if (!this.enabled) {
    return;
  }
  const doc = editor.document;
  if (doc.uri.scheme !== 'file') {
    return;
  }
  const relativePath = this.getRelativePath(doc.uri);
  if (!relativePath) {
    return;
  }

  try {
    if (await this.shouldSkipDocument(doc, relativePath)) {
      this.applyHunks(editor, []);
      return;
    }

    const headContent = await this.getHeadContent(doc.uri, relativePath);
    if (this.updateVersions.get(editor) !== updateVersion) {
      return;
    }
    if (headContent === null) {
      this.applyHunks(editor, [
        { kind: 'add', newStart: 0, newCount: doc.lineCount, oldCount: 0 }
      ]);
      return;
    }
    const hunks = computeLineHunks(headContent, doc.getText());
    this.applyHunks(editor, hunks);
  } catch (error) {
    this.logger.warn(`Gutter update failed for ${relativePath}: ${String(error)}`);
    this.applyHunks(editor, []);
  }
}

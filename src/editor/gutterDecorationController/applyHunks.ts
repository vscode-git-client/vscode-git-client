import * as vscode from 'vscode';
import type { LineHunk } from '../lineDiff';
import type { GutterDecorationControllerShape } from './index';

export function applyHunks(this: GutterDecorationControllerShape, editor: vscode.TextEditor, hunks: LineHunk[]): void {
  const added: vscode.Range[] = [];
  const modified: vscode.Range[] = [];
  const removed: vscode.Range[] = [];
  const lineCount = editor.document.lineCount;

  for (const hunk of hunks) {
    if (hunk.kind === 'remove') {
      const markerLine = Math.min(Math.max(hunk.newStart - 1, 0), Math.max(lineCount - 1, 0));
      if (lineCount > 0) {
        removed.push(new vscode.Range(markerLine, 0, markerLine, 0));
      }
      continue;
    }
    const start = hunk.newStart;
    const end = Math.min(hunk.newStart + hunk.newCount, lineCount);
    if (end <= start) {
      continue;
    }
    const range = new vscode.Range(start, 0, end - 1, 0);
    if (hunk.kind === 'add') {
      added.push(range);
    } else {
      modified.push(range);
    }
  }

  editor.setDecorations(this.decorations.added, added);
  editor.setDecorations(this.decorations.modified, modified);
  editor.setDecorations(this.decorations.removed, removed);
}

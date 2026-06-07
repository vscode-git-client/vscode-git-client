import * as vscode from 'vscode';
import type { GutterDecorationControllerShape } from './index';

export function clearAllVisible(this: GutterDecorationControllerShape): void {
  for (const editor of vscode.window.visibleTextEditors) {
    editor.setDecorations(this.decorations.added, []);
    editor.setDecorations(this.decorations.modified, []);
    editor.setDecorations(this.decorations.removed, []);
  }
}

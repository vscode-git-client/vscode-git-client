import * as vscode from 'vscode';
import type { GutterDecorationControllerShape } from './index';

export function updateAllVisible(this: GutterDecorationControllerShape): void {
  for (const editor of vscode.window.visibleTextEditors) {
    this.scheduleUpdate(editor, 0);
  }
}

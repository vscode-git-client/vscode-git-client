import * as vscode from 'vscode';
import type { GutterDecorationControllerShape } from './index';

export function scheduleUpdate(
  this: GutterDecorationControllerShape,
  editor: vscode.TextEditor,
  delay: number
): void {
  const existing = this.updateTimers.get(editor);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    this.updateTimers.delete(editor);
    void this.update(editor);
  }, delay);
  this.updateTimers.set(editor, timer);
}

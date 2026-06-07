import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export function pickConflictPathArg(arg: unknown): string | undefined {
  if (typeof arg === 'string' && arg.trim()) { return arg.trim(); }
  return undefined;
}

export async function pickConflictPath(this: CommandControllerShape, title: string): Promise<string | undefined> {
  const conflicts = this.state.conflicts.length > 0
    ? this.state.conflicts
    : await this.git.getMergeConflicts();
  if (conflicts.length === 0) {
    void vscode.window.showInformationMessage('No conflicted files.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    conflicts.map((c) => ({ label: c.path, description: c.status })),
    { title }
  );
  return picked?.label;
}

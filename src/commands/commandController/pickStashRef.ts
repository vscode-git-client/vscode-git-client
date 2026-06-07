import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export async function pickStashRef(this: CommandControllerShape, title: string): Promise<string | undefined> {
  await this.state.refreshStashes();
  const picked = await vscode.window.showQuickPick(
    this.state.stashes.map((stash) => ({
      label: stash.ref,
      description: stash.message,
      detail: stash.fileCount === undefined ? 'files not loaded' : `${stash.fileCount} files`
    })),
    { title }
  );

  return picked?.label;
}

import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';

export async function openDiffForFile(
  this: EditorOrchestratorShape,
  options: {
    path: string;
    leftRef: string;
    rightRef: string;
    title?: string;
  }
): Promise<void> {
  const leftUri = await this.createVirtualUri(options.leftRef, options.path);
  const rightUri = await this.createVirtualUri(options.rightRef, options.path);
  const title = options.title ?? `${options.leftRef} ↔ ${options.rightRef} · ${options.path}`;

  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: false,
    preserveFocus: false
  });
}

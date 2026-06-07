import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import { closeEmptyEditorGroups } from './closeEmptyEditorGroups';

export async function openCommitFileDiffWithStatus(
  this: EditorOrchestratorShape,
  sha: string,
  filePath: string,
  status?: string,
  options?: { oldPath?: string }
): Promise<void> {
  const title = `${sha.slice(0, 8)} parent ↔ commit · ${filePath}`;
  const normalizedStatus = (status ?? '').trim().toUpperCase();
  const oldPath = options?.oldPath?.trim();
  const leftPath = oldPath && normalizedStatus.startsWith('R') ? oldPath : filePath;

  let leftContent = '';
  let rightContent = '';

  if (normalizedStatus !== 'A') {
    leftContent = await this.readContentOrEmpty(`${sha}^`, leftPath);
  }

  if (normalizedStatus !== 'D') {
    rightContent = await this.readContentOrEmpty(sha, filePath);
  }

  const normalized = filePath.replaceAll(path.sep, '/');
  const leftUri = vscode.Uri.parse(
    `vscodegitclient:${encodeURIComponent(`${sha}^`)}/${normalized}`
  );
  const rightUri = vscode.Uri.parse(`vscodegitclient:${encodeURIComponent(sha)}/${normalized}`);
  this.contentProvider.setContent(leftUri, leftContent);
  this.contentProvider.setContent(rightUri, rightContent);

  await closeEmptyEditorGroups();
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: false,
    preserveFocus: false
  });
}

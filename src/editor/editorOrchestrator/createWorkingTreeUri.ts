import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import { fileExists } from './fileExists';
import { VIRTUAL_GIT_SCHEME, WORKTREE_REF, withVirtualGitMetadata } from './utils';

export async function createWorkingTreeUri(
  this: EditorOrchestratorShape,
  relativePath: string,
  status?: string
): Promise<vscode.Uri> {
  const gitRoot = await this.git.getGitRoot();
  const onDiskUri = vscode.Uri.file(path.join(gitRoot, relativePath));
  const fileMissing = status === 'D' || !(await fileExists(onDiskUri));
  if (!fileMissing) {
    return onDiskUri;
  }

  const normalized = relativePath.replaceAll(path.sep, '/');
  const uri = withVirtualGitMetadata(
    vscode.Uri.parse(`${VIRTUAL_GIT_SCHEME}:${encodeURIComponent(WORKTREE_REF)}/${normalized}`),
    { kind: 'worktree', ref: WORKTREE_REF, relativePath: normalized }
  );
  this.contentProvider.setContent(uri, '');
  return uri;
}

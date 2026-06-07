import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import type { ComparableDiffSide } from './utils';
import { VIRTUAL_GIT_SCHEME, withVirtualGitMetadata } from './utils';

export async function createComparableDiffUri(
  this: EditorOrchestratorShape,
  side: ComparableDiffSide,
  status?: string
): Promise<vscode.Uri> {
  if (side.kind === 'worktree') {
    return this.createWorkingTreeUri(side.relativePath, status);
  }
  if ((status ?? '').trim().toUpperCase().startsWith('A')) {
    const normalized = side.relativePath.replaceAll(/\\/g, '/');
    const uri = withVirtualGitMetadata(
      vscode.Uri.parse(`${VIRTUAL_GIT_SCHEME}:${encodeURIComponent(side.ref)}/${normalized}`),
      { kind: 'ref', ref: side.ref, relativePath: normalized }
    );
    this.contentProvider.setContent(uri, '');
    return uri;
  }
  return this.createVirtualUri(side.ref, side.relativePath);
}

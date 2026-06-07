import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import { VIRTUAL_GIT_SCHEME, withVirtualGitMetadata } from './utils';

export async function createVirtualUri(
  this: EditorOrchestratorShape,
  ref: string,
  relativePath: string
): Promise<vscode.Uri> {
  const normalized = relativePath.replaceAll(path.sep, '/');
  const uri = withVirtualGitMetadata(
    vscode.Uri.parse(`${VIRTUAL_GIT_SCHEME}:${encodeURIComponent(ref)}/${normalized}`),
    { kind: 'ref', ref, relativePath: normalized }
  );
  const content = await this.git.getFileContentFromRef(ref, relativePath);
  this.contentProvider.setContent(uri, content);
  return uri;
}

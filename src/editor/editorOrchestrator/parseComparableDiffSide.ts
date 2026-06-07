import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import type { ComparableDiffSide } from './utils';
import { VIRTUAL_GIT_SCHEME, parseVirtualGitUri } from './utils';

export async function parseComparableDiffSide(
  this: EditorOrchestratorShape,
  uri: vscode.Uri
): Promise<ComparableDiffSide | undefined> {
  if (uri.scheme === VIRTUAL_GIT_SCHEME) {
    const parsed = parseVirtualGitUri(uri);
    if (!parsed) {
      return undefined;
    }
    if (parsed.kind === 'worktree') {
      return { kind: 'worktree', relativePath: parsed.relativePath };
    }
    return { kind: 'ref', ref: parsed.ref, relativePath: parsed.relativePath };
  }

  if (uri.scheme === 'file') {
    const repoRelative = this.git.toRepoRelative(uri.fsPath);
    if (repoRelative === undefined) {
      return undefined;
    }
    return { kind: 'worktree', relativePath: repoRelative };
  }

  return undefined;
}

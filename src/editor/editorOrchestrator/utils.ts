import * as vscode from 'vscode';
import { getConfigValue } from '../../configuration';

export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
export const VIRTUAL_GIT_SCHEME = 'vscodegitclient';
export const WORKTREE_REF = 'WORKTREE';

export type ComparableDiffSide =
  | { kind: 'ref'; ref: string; relativePath: string }
  | { kind: 'worktree'; relativePath: string };

export type CompareWithRevisionDirection = 'forward' | 'reverse';

export function formatRevisionLabel(ref: string): string {
  const token = (ref ?? '').trim();
  if (!token) {
    return '';
  }
  if (/^[0-9a-f]{9,}$/i.test(token)) {
    return token.slice(0, 8);
  }
  return token;
}

export function formatComparableSideLabel(side: ComparableDiffSide): string {
  return side.kind === 'worktree' ? 'working tree' : formatRevisionLabel(side.ref);
}

export function formatCompareWithRevisionSideLabel(
  side: ComparableDiffSide,
  ref: string,
  refLabel: string
): string {
  if (side.kind === 'worktree') {
    return 'working tree';
  }
  return side.ref === ref ? refLabel : formatRevisionLabel(side.ref);
}

export function getCompareWithRevisionDirection(): CompareWithRevisionDirection {
  const configured = getConfigValue<string>('compareWithRevision.defaultDirection', 'forward');
  return configured === 'reverse' ? 'reverse' : 'forward';
}

export function parseVirtualGitUri(
  uri: vscode.Uri
): { kind: 'ref' | 'worktree'; ref: string; relativePath: string } | undefined {
  const fromQuery = parseVirtualGitMetadata(uri.query);
  if (fromQuery) {
    return fromQuery;
  }

  const raw = uri.toString(true);
  const prefix = `${VIRTUAL_GIT_SCHEME}:`;
  if (!raw.startsWith(prefix)) {
    return undefined;
  }

  const payload = raw.slice(prefix.length);
  const separator = payload.indexOf('/');
  if (separator < 0) {
    return undefined;
  }

  const ref = decodeURIComponent(payload.slice(0, separator));
  const relativePath = decodeURI(payload.slice(separator + 1));
  if (!ref || !relativePath) {
    return undefined;
  }

  return {
    kind: ref === WORKTREE_REF ? 'worktree' : 'ref',
    ref,
    relativePath
  };
}

export function withVirtualGitMetadata(
  uri: vscode.Uri,
  metadata: { kind: 'ref' | 'worktree'; ref: string; relativePath: string }
): vscode.Uri {
  const query = new URLSearchParams({
    kind: metadata.kind,
    ref: metadata.ref,
    path: metadata.relativePath
  });
  return uri.with({ query: query.toString() });
}

export function parseVirtualGitMetadata(
  query: string
): { kind: 'ref' | 'worktree'; ref: string; relativePath: string } | undefined {
  if (!query) {
    return undefined;
  }

  const params = new URLSearchParams(query);
  const kind = params.get('kind') === 'worktree' ? 'worktree' : 'ref';
  const ref = params.get('ref') ?? '';
  const relativePath = params.get('path') ?? '';
  if (!ref || !relativePath) {
    return undefined;
  }

  return { kind, ref, relativePath };
}

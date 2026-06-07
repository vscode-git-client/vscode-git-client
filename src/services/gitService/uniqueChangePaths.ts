import type { VsCodeGitChange } from './types';

export function uniqueChangePaths(changes: readonly VsCodeGitChange[]): string[] {
  return [...new Set(changes.map((change) => change.uri.fsPath))];
}

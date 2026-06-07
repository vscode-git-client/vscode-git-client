import * as vscode from 'vscode';
import type { GitServiceShape } from '.';
import type { RepoChangeSet } from '../repositoryStateDiff';
import {
  buildRepositoryFingerprint,
  diffRepositoryFingerprints,
  isEmptyChangeSet,
  RepositoryFingerprint
} from '../repositoryStateDiff';

export async function onRepositoryStateChange(
  this: GitServiceShape,
  listener: (changeSet: RepoChangeSet) => void
): Promise<vscode.Disposable | undefined> {
  const repository = await this.getVsCodeRepository();
  if (!repository?.state.onDidChange) {
    return undefined;
  }
  let last: RepositoryFingerprint = buildRepositoryFingerprint(repository.state);
  return repository.state.onDidChange(() => {
    const next = buildRepositoryFingerprint(repository.state);
    const changeSet = diffRepositoryFingerprints(last, next);
    last = next;
    if (isEmptyChangeSet(changeSet)) {
      return;
    }
    listener(changeSet);
  });
}

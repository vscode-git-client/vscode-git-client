import type { WorkingTreeChange } from '../../types';
import type { GitServiceShape } from '.';

export async function getChangedFilesFromVsCodeGit(this: GitServiceShape): Promise<WorkingTreeChange[] | undefined> {
  const repository = await this.getVsCodeRepository();
  if (!repository) {
    return undefined;
  }

  const changes = new Map<string, string>();
  const setStatus = (change: { uri: { fsPath: string } }, status: string): void => {
    const relativePath = this.toRepoRelative(change.uri.fsPath);
    if (!relativePath) {
      return;
    }

    if (status === '??' || status === 'UU') {
      changes.set(relativePath, status);
      return;
    }

    const existing = changes.get(relativePath) ?? '  ';
    const next = [
      status[0] !== ' ' ? status[0] : existing[0],
      status[1] !== ' ' ? status[1] : existing[1]
    ].join('');
    changes.set(relativePath, next);
  };

  repository.state.indexChanges.forEach((change) => setStatus(change, 'M '));
  repository.state.workingTreeChanges.forEach((change) => setStatus(change, ' M'));
  repository.state.untrackedChanges.forEach((change) => setStatus(change, '??'));
  repository.state.mergeChanges.forEach((change) => setStatus(change, 'UU'));

  return [...changes.entries()]
    .map(([path, status]) => ({ path, status }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

import type { GitServiceShape } from '.';

export async function resolveExactBranchRef(this: GitServiceShape, branch: string): Promise<string | undefined> {
  const query = branch.trim();
  if (!query) {
    return undefined;
  }

  const localFull = `refs/heads/${query}`;
  const remoteFull = `refs/remotes/${query}`;
  const remotesWildcard = `refs/remotes/*/${query}`;

  if (await this.refExists(localFull)) {
    return localFull;
  }
  if (await this.refExists(remoteFull)) {
    return remoteFull;
  }
  if (await this.refPatternExists(remotesWildcard)) {
    return remotesWildcard;
  }

  return undefined;
}

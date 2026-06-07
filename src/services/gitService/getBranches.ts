import type { BranchRef } from '../../types';
import type { GitServiceShape } from '.';
import { BRANCH_SORT_COMPARATOR } from './getLocalBranches';

export async function getBranches(this: GitServiceShape): Promise<BranchRef[]> {
  const remoteUrls = await this.getRemoteFetchUrls();
  const [locals, remotes] = await Promise.all([
    this.getLocalBranches(),
    this.getRemoteBranches(remoteUrls)
  ]);
  return [...locals, ...remotes].sort(BRANCH_SORT_COMPARATOR);
}

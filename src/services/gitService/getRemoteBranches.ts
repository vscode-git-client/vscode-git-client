import type { BranchRef } from '../../types';
import type { GitServiceShape } from '.';
import { parseBranchLines } from './parseBranchLines';
import { BRANCH_FORMAT, BRANCH_SORT_COMPARATOR } from './getLocalBranches';
import { RECORD_SEPARATOR } from './constants';

export async function getRemoteBranches(
  this: GitServiceShape,
  remoteUrls: Map<string, string>
): Promise<BranchRef[]> {
  const result = await this.runGit([
    'for-each-ref',
    `--format=${BRANCH_FORMAT}${RECORD_SEPARATOR}`,
    'refs/remotes'
  ]);
  return parseBranchLines(result.stdout, remoteUrls).sort(BRANCH_SORT_COMPARATOR);
}

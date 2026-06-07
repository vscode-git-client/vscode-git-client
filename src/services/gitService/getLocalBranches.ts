import type { BranchRef } from '../../types';
import type { GitServiceShape } from '.';
import { parseBranchLines } from './parseBranchLines';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

const BRANCH_FORMAT = [
  '%(refname:short)',
  '%(refname)',
  '%(upstream:short)',
  '%(upstream:track)',
  '%(HEAD)',
  '%(committerdate:unix)'
].join(FIELD_SEPARATOR);

const BRANCH_SORT_COMPARATOR = (a: BranchRef, b: BranchRef): number => {
  if (a.current) { return -1; }
  if (b.current) { return 1; }
  if (a.type !== b.type) { return a.type === 'local' ? -1 : 1; }
  return a.name.localeCompare(b.name);
};

export { BRANCH_FORMAT, BRANCH_SORT_COMPARATOR };

export async function getLocalBranches(this: GitServiceShape): Promise<BranchRef[]> {
  const result = await this.runGit([
    'for-each-ref',
    `--format=${BRANCH_FORMAT}${RECORD_SEPARATOR}`,
    'refs/heads'
  ]);
  return parseBranchLines(result.stdout, new Map()).sort(BRANCH_SORT_COMPARATOR);
}

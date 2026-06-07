import { getConfigValue } from '../../configuration';
import { BranchRef } from '../../types';

export function getRecentBranches(branches: BranchRef[]): BranchRef[] {
  const maxRecent = Math.min(10, Math.max(1, getConfigValue<number>('recentBranchesCount', 3)));
  return [...branches]
    .sort((a, b) => {
      if (a.current) {
        return -1;
      }
      if (b.current) {
        return 1;
      }
      const left = a.lastCommitEpoch ?? 0;
      const right = b.lastCommitEpoch ?? 0;
      if (left !== right) {
        return right - left;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxRecent);
}

import type { WorktreePruneEntry } from '../../types';
import { parseWorktreePruneDryRun } from '../worktreeParsing';
import type { GitServiceShape } from '.';

export async function getPrunableWorktrees(this: GitServiceShape): Promise<WorktreePruneEntry[]> {
  const result = await this.runGit(['worktree', 'prune', '--dry-run']);
  return parseWorktreePruneDryRun(result.stdout + result.stderr);
}

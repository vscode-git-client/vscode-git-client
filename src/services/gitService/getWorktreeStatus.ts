import type { WorktreeStatus } from '../../types';
import { parseTrack } from '../gitParsing';
import type { GitServiceShape } from '.';

export async function getWorktreeStatus(this: GitServiceShape, worktreePath: string): Promise<WorktreeStatus> {
  const statusResult = await this.runGitAt(worktreePath, ['status', '--porcelain=v1', '--branch']);
  const lines = statusResult.stdout.split('\n');
  const branchLine = lines[0] ?? '';
  const isDirty = lines.slice(1).some((l) => l.trim().length > 0);
  const { ahead, behind } = parseTrack(branchLine);
  return { isDirty, ahead, behind };
}

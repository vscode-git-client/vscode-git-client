import type { WorktreeEntry } from '../../types';
import { parseWorktreeListPorcelain } from '../worktreeParsing';
import type { GitServiceShape } from '.';

export async function getWorktrees(this: GitServiceShape): Promise<WorktreeEntry[]> {
  const result = await this.runGit(['worktree', 'list', '--porcelain']);
  const raw = parseWorktreeListPorcelain(result.stdout);
  const currentPath = this.gitRoot;

  return Promise.all(
    raw.map(async (w) => {
      let status = { isDirty: false, ahead: 0, behind: 0 };
      let headSubject: string | undefined;
      try {
        status = await this.getWorktreeStatus(w.worktreePath);
        const logResult = await this.runGitAt(w.worktreePath, ['log', '-1', '--format=%s']);
        headSubject = logResult.stdout.trim() || undefined;
      } catch { /* worktree may be unavailable */ }
      return {
        ...w,
        isCurrent: w.worktreePath === currentPath,
        isDirty: status.isDirty,
        ahead: status.ahead,
        behind: status.behind,
        headSubject
      };
    })
  );
}

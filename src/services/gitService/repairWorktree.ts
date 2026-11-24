import * as fs from 'fs/promises';
import * as path from 'path';
import type { GitService } from './index';

/**
 * Re-links a worktree that was moved on disk. Runs `git worktree repair <newPath>`,
 * which rewrites the main repository's `.git/worktrees/<name>/gitdir` pointer so it
 * references the new location.
 */
export async function repairWorktree(this: GitService, newWorktreePath: string): Promise<void> {
  const dotGitPath = path.join(newWorktreePath, '.git');
  let dotGitContent: string;
  try {
    dotGitContent = await fs.readFile(dotGitPath, 'utf8');
  } catch {
    throw new Error(
      `${newWorktreePath} is not a linked worktree (no .git file found). Pick the folder you moved the worktree to.`
    );
  }

  const match = /^gitdir:\s*(.+?)\s*$/m.exec(dotGitContent);
  if (!match) {
    throw new Error(`${dotGitPath} does not contain a valid "gitdir:" pointer.`);
  }

  // The worktree must belong to this repository: <commonDir>/worktrees/<name>
  const adminDir = path.resolve(newWorktreePath, match[1]);
  const commonDirResult = await this.runGit(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const commonDir = commonDirResult.stdout.trim();
  const [realAdminParent, realCommonDir] = await Promise.all([
    realpathOrSelf(path.dirname(path.dirname(adminDir))),
    realpathOrSelf(commonDir)
  ]);
  if (path.basename(path.dirname(adminDir)) !== 'worktrees' || realAdminParent !== realCommonDir) {
    throw new Error(`${newWorktreePath} belongs to a different repository.`);
  }

  await this.runGit(['worktree', 'repair', newWorktreePath]);
}

async function realpathOrSelf(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    return path.resolve(p);
  }
}

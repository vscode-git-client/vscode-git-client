import type { GitServiceShape } from '.';

export async function isCommitInCurrentBranch(this: GitServiceShape, sha: string): Promise<boolean> {
  try {
    await this.runGit(['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

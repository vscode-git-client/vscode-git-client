import type { GitServiceShape } from '.';

export async function isRepo(this: GitServiceShape): Promise<boolean> {
  const vscodeGitRoot = await this.getVsCodeGitRoot();
  if (vscodeGitRoot) {
    return true;
  }
  try {
    const result = await this.runGit(['rev-parse', '--is-inside-work-tree']);
    return result.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

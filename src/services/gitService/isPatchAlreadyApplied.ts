import type { GitServiceShape } from '.';

export async function isPatchAlreadyApplied(this: GitServiceShape, patch: string): Promise<boolean> {
  if (!patch.trim()) {
    return false;
  }

  try {
    await this.runGitWithStdin(['apply', '--check', '--reverse', '--whitespace=nowarn'], patch);
    return true;
  } catch {
    return false;
  }
}

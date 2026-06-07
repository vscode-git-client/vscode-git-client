import type { GitServiceShape } from '.';

export async function canApplyPatchToWorkingTree(this: GitServiceShape, patch: string): Promise<boolean> {
  if (!patch.trim()) {
    return false;
  }

  try {
    await this.runGitWithStdin(['apply', '--check', '--3way', '--whitespace=nowarn'], patch);
    return true;
  } catch {
    return false;
  }
}

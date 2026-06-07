import type { GitServiceShape } from '.';

export async function applyPatchToWorkingTree(this: GitServiceShape, patch: string): Promise<void> {
  if (!patch.trim()) {
    return;
  }

  await this.runGitWithStdin(['apply', '--3way', '--whitespace=nowarn'], patch);
}

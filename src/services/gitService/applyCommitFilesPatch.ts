import type { GitServiceShape } from '.';

export async function applyCommitFilesPatch(
  this: GitServiceShape,
  ref: string,
  filePaths: string[],
  reverse: boolean
): Promise<void> {
  if (filePaths.length === 0) {
    return;
  }

  const patch = await this.getPatchForCommitFiles(ref, filePaths);
  if (!patch.trim()) {
    return;
  }

  if (reverse) {
    await this.runGitWithStdin(['apply', '--3way', '--whitespace=nowarn', '-R'], patch);
    return;
  }
  await this.applyPatchToWorkingTree(patch);
}

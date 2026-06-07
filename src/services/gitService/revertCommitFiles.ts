import type { GitServiceShape } from '.';

export async function revertCommitFiles(
  this: GitServiceShape,
  ref: string,
  filePaths: string[]
): Promise<void> {
  await this.applyCommitFilesPatch(ref, filePaths, true);
}

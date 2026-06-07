import type { GitServiceShape } from '.';

export async function cherryPickCommitFiles(
  this: GitServiceShape,
  ref: string,
  filePaths: string[]
): Promise<void> {
  await this.applyCommitFilesPatch(ref, filePaths, false);
}

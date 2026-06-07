import type { GitServiceShape } from '.';

export async function revertCommit(this: GitServiceShape, ref: string): Promise<void> {
  await this.runGit(['revert', ref]);
}

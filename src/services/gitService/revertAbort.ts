import type { GitServiceShape } from '.';

export async function revertAbort(this: GitServiceShape): Promise<void> {
  await this.runGit(['revert', '--abort']);
}

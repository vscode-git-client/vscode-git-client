import type { GitServiceShape } from '.';

export async function rebaseAbort(this: GitServiceShape): Promise<void> {
  await this.runGit(['rebase', '--abort']);
}

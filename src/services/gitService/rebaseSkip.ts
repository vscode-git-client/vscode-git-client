import type { GitServiceShape } from '.';

export async function rebaseSkip(this: GitServiceShape): Promise<void> {
  await this.runGit(['rebase', '--skip']);
}

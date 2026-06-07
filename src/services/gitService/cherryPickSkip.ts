import type { GitServiceShape } from '.';

export async function cherryPickSkip(this: GitServiceShape): Promise<void> {
  await this.runGit(['cherry-pick', '--skip']);
}

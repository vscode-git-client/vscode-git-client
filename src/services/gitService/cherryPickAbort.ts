import type { GitServiceShape } from '.';

export async function cherryPickAbort(this: GitServiceShape): Promise<void> {
  await this.runGit(['cherry-pick', '--abort']);
}

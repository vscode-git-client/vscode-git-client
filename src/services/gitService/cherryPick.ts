import type { GitServiceShape } from '.';

export async function cherryPick(this: GitServiceShape, ref: string): Promise<void> {
  await this.runGit(['cherry-pick', ref]);
}

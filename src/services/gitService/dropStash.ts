import type { GitServiceShape } from '.';

export async function dropStash(this: GitServiceShape, ref: string): Promise<void> {
  await this.runGit(['stash', 'drop', ref]);
}

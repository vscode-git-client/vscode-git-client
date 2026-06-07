import type { GitServiceShape } from '.';

export async function unstashToWorkingTree(this: GitServiceShape, ref: string): Promise<void> {
  await this.runGit(['stash', 'pop', ref]);
}

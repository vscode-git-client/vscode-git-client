import type { GitServiceShape } from '.';

export async function mergeIntoCurrent(this: GitServiceShape, branch: string): Promise<void> {
  await this.runGit(['merge', '--no-ff', branch]);
}

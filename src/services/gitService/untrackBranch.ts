import type { GitServiceShape } from '.';

export async function untrackBranch(this: GitServiceShape, localBranch: string): Promise<void> {
  await this.runGit(['branch', '--unset-upstream', localBranch]);
}

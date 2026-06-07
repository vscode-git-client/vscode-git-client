import type { GitServiceShape } from '.';

export async function renameBranch(this: GitServiceShape, from: string, to: string): Promise<void> {
  await this.runGit(['branch', '-m', from, to]);
}

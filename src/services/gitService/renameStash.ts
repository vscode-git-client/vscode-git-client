import type { GitServiceShape } from '.';

export async function renameStash(this: GitServiceShape, ref: string, message: string): Promise<void> {
  const stashHash = (await this.runGit(['rev-parse', ref])).stdout.trim();
  await this.runGit(['stash', 'drop', ref]);
  await this.runGit(['stash', 'store', '-m', message, stashHash]);
}

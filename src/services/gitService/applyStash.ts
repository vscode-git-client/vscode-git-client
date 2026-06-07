import type { GitServiceShape } from '.';

export async function applyStash(this: GitServiceShape, ref: string, pop = false): Promise<void> {
  await this.runGit(['stash', pop ? 'pop' : 'apply', ref]);
}

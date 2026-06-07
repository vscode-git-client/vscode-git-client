import type { GitServiceShape } from '.';

export async function getStashPatch(this: GitServiceShape, ref: string): Promise<string> {
  const result = await this.runGit(['stash', 'show', '-p', ref]);
  return result.stdout;
}

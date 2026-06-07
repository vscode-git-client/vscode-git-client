import type { GitServiceShape } from '.';

export async function refPatternExists(this: GitServiceShape, pattern: string): Promise<boolean> {
  const result = await this.runGit(['for-each-ref', '--format=%(refname)', pattern]);
  return result.stdout.trim().length > 0;
}

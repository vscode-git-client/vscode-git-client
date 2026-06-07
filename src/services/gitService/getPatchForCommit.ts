import type { GitServiceShape } from '.';

export async function getPatchForCommit(this: GitServiceShape, sha: string): Promise<string> {
  const result = await this.runGit(['format-patch', '--stdout', '-1', sha]);
  return result.stdout;
}

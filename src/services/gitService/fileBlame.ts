import type { GitServiceShape } from '.';

export async function fileBlame(this: GitServiceShape, filePath: string): Promise<string> {
  const result = await this.runGit(['blame', '--', filePath]);
  return result.stdout;
}

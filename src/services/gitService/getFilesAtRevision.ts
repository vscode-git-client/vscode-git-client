import type { GitServiceShape } from '.';

export async function getFilesAtRevision(this: GitServiceShape, ref: string): Promise<string[]> {
  const result = await this.runGit(['ls-tree', '-r', '--name-only', ref]);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

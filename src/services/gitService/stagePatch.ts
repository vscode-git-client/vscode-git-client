import type { GitServiceShape } from '.';

export async function stagePatch(this: GitServiceShape, filePath: string): Promise<void> {
  await this.runGit(['add', '-p', '--', filePath]);
}

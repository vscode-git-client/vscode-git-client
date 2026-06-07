import type { GitServiceShape } from '.';

export async function getFilesInCommit(this: GitServiceShape, sha: string): Promise<string[]> {
  const entries = await this.getFilesInCommitWithStatus(sha);
  return entries.map((entry) => entry.path);
}

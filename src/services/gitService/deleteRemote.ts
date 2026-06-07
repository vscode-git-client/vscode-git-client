import type { GitServiceShape } from '.';

export async function deleteRemote(this: GitServiceShape, remoteName: string): Promise<void> {
  await this.runGit(['remote', 'remove', remoteName]);
}

import type { GitServiceShape } from '.';

export async function addRemote(this: GitServiceShape, remoteName: string, remoteUrl: string): Promise<void> {
  await this.runGit(['remote', 'add', remoteName, remoteUrl]);
}

import type { GitServiceShape } from '.';

export async function setRemoteUrl(this: GitServiceShape, remoteName: string, remoteUrl: string): Promise<void> {
  await this.runGit(['remote', 'set-url', remoteName, remoteUrl]);
}

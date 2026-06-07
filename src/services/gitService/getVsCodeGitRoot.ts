import type { GitServiceShape } from '.';

export async function getVsCodeGitRoot(this: GitServiceShape): Promise<string | undefined> {
  try {
    const api = await this.getVsCodeGitApi();
    const rootUri = await api?.getRepositoryRoot(this.context.rootUri);
    return rootUri?.fsPath;
  } catch {
    return undefined;
  }
}

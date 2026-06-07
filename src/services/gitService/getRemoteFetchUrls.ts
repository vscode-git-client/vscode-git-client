import type { GitServiceShape } from '.';

export async function getRemoteFetchUrls(this: GitServiceShape): Promise<Map<string, string>> {
  try {
    const result = await this.runGit(['remote', '-v']);
    const urls = new Map<string, string>();
    for (const line of result.stdout.split(/\r?\n/)) {
      const match = line.trim().match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!match) {
        continue;
      }
      const [, remoteName, remoteUrl, mode] = match;
      if (mode !== 'fetch' || urls.has(remoteName)) {
        continue;
      }
      urls.set(remoteName, remoteUrl);
    }
    return urls;
  } catch {
    return new Map<string, string>();
  }
}

import type { GitServiceShape } from '.';

export async function getTagAvailabilityByRemote(this: GitServiceShape): Promise<Map<string, Set<string>>> {
  const resultMap = new Map<string, Set<string>>();
  try {
    const remoteUrls = await this.getRemoteFetchUrls();
    const remotes = Array.from(remoteUrls.keys()).sort((a, b) => a.localeCompare(b));
    for (const remote of remotes) {
      let output = '';
      try {
        output = (await this.runGit(['ls-remote', '--tags', remote])).stdout;
      } catch {
        continue;
      }
      for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const [, ref] = trimmed.split(/\s+/, 2);
        if (!ref?.startsWith('refs/tags/')) {
          continue;
        }
        const tagName = ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '');
        const remotesForTag = resultMap.get(tagName) ?? new Set<string>();
        remotesForTag.add(remote);
        resultMap.set(tagName, remotesForTag);
      }
    }
  } catch {
    return resultMap;
  }
  return resultMap;
}

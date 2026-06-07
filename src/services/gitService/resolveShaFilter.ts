import type { GitServiceShape } from '.';

export async function resolveShaFilter(this: GitServiceShape, message: string): Promise<string | undefined> {
  const trimmed = message.trim();
  if (!/^[0-9a-f]{4,40}$/i.test(trimmed)) {
    return undefined;
  }
  try {
    const result = await this.runGit(['rev-parse', '--verify', trimmed]);
    const sha = result.stdout.trim();
    return sha || undefined;
  } catch {
    return undefined;
  }
}

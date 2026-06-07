import type { GitServiceShape } from '.';

export async function getParentCommit(this: GitServiceShape, sha: string): Promise<string | undefined> {
  const result = await this.runGit(['rev-list', '--parents', '-n', '1', sha]);
  const tokens = result.stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) {
    return undefined;
  }

  return tokens[1];
}

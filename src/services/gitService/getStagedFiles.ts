import type { GitServiceShape } from '.';

export async function getStagedFiles(this: GitServiceShape): Promise<string[]> {
  const result = await this.runGit(['diff', '--cached', '--name-only']);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

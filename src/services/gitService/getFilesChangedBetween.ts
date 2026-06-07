import type { GitServiceShape } from '.';

export async function getFilesChangedBetween(
  this: GitServiceShape,
  leftRef: string,
  rightRef: string
): Promise<string[]> {
  const result = await this.runGit(['diff', '--name-only', `${leftRef}...${rightRef}`]);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

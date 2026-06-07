import type { MergeConflictFile } from '../../types';
import type { GitServiceShape } from '.';

export async function getMergeConflicts(this: GitServiceShape): Promise<MergeConflictFile[]> {
  const result = await this.runGit(['diff', '--name-status', '--diff-filter=U']);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status, path };
    });
}

import type { CommitFileChange } from '../../types';
import type { GitServiceShape } from '.';

export async function getFilesChangedBetweenRefsWithStatus(
  this: GitServiceShape,
  fromRef: string,
  toRef: string
): Promise<CommitFileChange[]> {
  const result = await this.runGit(['diff', '--name-status', fromRef, toRef]);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t').filter(Boolean);
      const statusRaw = parts[0] ?? '';
      const status = (statusRaw ?? '').trim();
      const normalizedStatus = status[0]?.toUpperCase();
      const oldPath = normalizedStatus === 'R' || normalizedStatus === 'C'
        ? (parts[1] ?? '').trim()
        : undefined;
      const path = (parts.at(-1) ?? '').trim();
      return { status, path, oldPath };
    })
    .filter((entry) => Boolean(entry.path));
}

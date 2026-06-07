import type { StashEntry } from '../../types';
import type { GitServiceShape } from '.';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function getStashes(this: GitServiceShape): Promise<StashEntry[]> {
  let result;
  try {
    result = await this.runGit([
      'reflog',
      'show',
      'refs/stash',
      '--date=iso-strict',
      `--format=%gd${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%gs${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${RECORD_SEPARATOR}`
    ]);
  } catch {
    return [];
  }
  const lines = result.stdout
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: StashEntry[] = [];
  for (const line of lines) {
    const [refRaw, sha, subject, author, timestamp] = line.split(FIELD_SEPARATOR);
    const refMatch = refRaw.match(/^stash@\{(\d+)\}$/);
    const index = Number(refMatch?.[1] ?? entries.length);
    const ref = `stash@{${index}}`;
    const message = subject.replace(/^(?:On|WIP on)\s+[^:]+:\s*/, '').trim() || subject;
    entries.push({
      index,
      ref,
      message: message || subject,
      author: author || undefined,
      timestamp: timestamp || undefined,
      sha: sha || undefined
    });
  }

  return entries.sort((a, b) => a.index - b.index);
}

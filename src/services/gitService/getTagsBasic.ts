import type { TagRef } from '../../types';
import type { GitServiceShape } from '.';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

const TAG_FORMAT = [
  '%(refname:short)',
  '%(refname)',
  '%(objectname)',
  '%(*objectname)',
  '%(creatordate:unix)'
].join(FIELD_SEPARATOR);

const TAG_SORT_COMPARATOR = (a: TagRef, b: TagRef): number => {
  const left = a.lastCommitEpoch ?? 0;
  const right = b.lastCommitEpoch ?? 0;
  if (left !== right) { return right - left; }
  return a.name.localeCompare(b.name);
};

export { TAG_FORMAT, TAG_SORT_COMPARATOR };

export async function getTagsBasic(this: GitServiceShape): Promise<TagRef[]> {
  const result = await this.runGit([
    'for-each-ref',
    `--format=${TAG_FORMAT}${RECORD_SEPARATOR}`,
    'refs/tags'
  ]);
  return result.stdout
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, fullName, objectSha, peeledSha, commitEpochRaw] = line.split(FIELD_SEPARATOR);
      const commitEpoch = Number.parseInt((commitEpochRaw ?? '').trim(), 10);
      return {
        name,
        fullName,
        sha: peeledSha || objectSha || undefined,
        availableOnRemotes: [] as string[],
        lastCommitEpoch: Number.isNaN(commitEpoch) ? undefined : commitEpoch
      };
    })
    .sort(TAG_SORT_COMPARATOR);
}

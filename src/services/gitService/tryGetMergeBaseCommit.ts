import type { GraphCommit } from '../../types';
import type { GitServiceShape } from '.';
import { parseGraphRows } from './parseGraphRows';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function tryGetMergeBaseCommit(
  this: GitServiceShape,
  leftRef: string,
  rightRef: string
): Promise<GraphCommit | undefined> {
  try {
    const base = await this.runGit(['merge-base', leftRef, rightRef]);
    const sha = base.stdout.trim();
    if (!sha) {
      return undefined;
    }
    const detail = await this.runGit([
      'log',
      '-1',
      '--date=iso-strict',
      `--format=%m${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
      sha
    ]);
    const [parsed] = parseGraphRows(detail.stdout);
    return parsed;
  } catch {
    return undefined;
  }
}

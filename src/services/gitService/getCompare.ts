import type { CompareResult } from '../../types';
import type { GitServiceShape } from '.';
import { parseGraphRows } from './parseGraphRows';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function getCompare(
  this: GitServiceShape,
  leftRef: string,
  rightRef: string
): Promise<CompareResult> {
  const leftOnly = await this.runGit([
    'log',
    '--date=iso-strict',
    `--format=%m${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
    `${rightRef}..${leftRef}`
  ]);
  const rightOnly = await this.runGit([
    'log',
    '--date=iso-strict',
    `--format=%m${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
    `${leftRef}..${rightRef}`
  ]);

  const diffNames = await this.runGit(['diff', '--name-status', `${leftRef}...${rightRef}`]);

  const mergeBase = await this.tryGetMergeBaseCommit(leftRef, rightRef);

  return {
    leftRef,
    rightRef,
    commitsOnlyLeft: parseGraphRows(leftOnly.stdout),
    commitsOnlyRight: parseGraphRows(rightOnly.stdout),
    mergeBase,
    changedFiles: diffNames.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [status, path] = line.split('\t');
        return {
          status,
          path
        };
      })
  };
}

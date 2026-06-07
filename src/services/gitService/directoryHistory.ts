import type { GraphCommit } from '../../types';
import type { GitServiceShape } from '.';
import { parseGraphRows } from './parseGraphRows';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function directoryHistory(
  this: GitServiceShape,
  dirPath: string,
  onBatch?: (commits: GraphCommit[]) => void
): Promise<GraphCommit[]> {
  const format = `%m${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`;
  const args = ['log', '--date=iso-strict', '--no-renames', `--format=${format}`];
  const normalizedPath = dirPath.trim();
  if (normalizedPath) {
    args.push('--', normalizedPath);
  }

  if (!onBatch) {
    const result = await this.runGit(args);
    return parseGraphRows(result.stdout);
  }

  return this.streamLogRecords(args, onBatch);
}

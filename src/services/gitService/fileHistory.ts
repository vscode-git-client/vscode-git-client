import type { GraphCommit } from '../../types';
import type { GitServiceShape } from '.';
import { parseGraphRows } from './parseGraphRows';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function fileHistory(this: GitServiceShape, filePath: string): Promise<GraphCommit[]> {
  const format = `%m${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`;
  const result = await this.runGit(['log', '--date=iso-strict', '--follow', `--format=${format}`, '--', filePath]);
  return parseGraphRows(result.stdout);
}

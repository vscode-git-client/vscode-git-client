import type { GraphCommit } from '../../types';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export function parseGraphRows(raw: string): GraphCommit[] {
  return raw
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [graph, sha, shortSha, parentsRaw, refsRaw, author, date, subject] = line.split(FIELD_SEPARATOR);
      return {
        graph,
        sha,
        shortSha,
        parents: parentsRaw?.split(' ').filter(Boolean) ?? [],
        refs: refsRaw ? refsRaw.split(',').map((r) => r.trim()).filter(Boolean) : [],
        author,
        date,
        subject
      };
    });
}

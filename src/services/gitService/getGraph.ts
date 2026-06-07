import type { CommitFilters, GraphCommit } from '../../types';
import type { GitServiceShape } from '.';
import { parseGraphRows } from './parseGraphRows';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export async function getGraph(
  this: GitServiceShape,
  maxCount: number,
  skip = 0,
  filters?: CommitFilters
): Promise<GraphCommit[]> {
  const format = [
    '%m',
    '%H',
    '%h',
    '%P',
    '%D',
    '%an',
    '%aI',
    '%s'
  ].join(FIELD_SEPARATOR);

  const args = ['log', '--date=iso-strict', '--decorate=full', `--max-count=${maxCount}`, `--format=${format}${RECORD_SEPARATOR}`];
  if (skip > 0) {
    args.push(`--skip=${skip}`);
  }

  if (filters?.branch) {
    const branchKeyword = filters.branch.trim();
    const exactBranchRef = await this.resolveExactBranchRef(branchKeyword);
    if (exactBranchRef) {
      args.push(exactBranchRef);
    } else {
      args.push(`--branches=*${branchKeyword}*`, `--remotes=*${branchKeyword}*`);
    }
  } else {
    args.push('--all');
  }
  if (filters?.author) {
    args.push(`--author=${filters.author}`);
  }
  if (filters?.message) {
    const sha = await this.resolveShaFilter(filters.message);
    if (sha) {
      args.push(sha);
    } else {
      args.push(`--grep=${filters.message}`);
    }
  }
  if (filters?.since) {
    args.push(`--since=${filters.since}`);
  }
  if (filters?.until) {
    args.push(`--until=${filters.until}`);
  }

  const result = await this.runGit(args);
  return parseGraphRows(result.stdout);
}

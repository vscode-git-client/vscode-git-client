import type { WorkingTreeChange } from '../../types';
import { parsePorcelainStatusZ } from '../gitParsing';
import type { GitServiceShape } from '.';

export async function getChangedFiles(this: GitServiceShape): Promise<WorkingTreeChange[]> {
  const vscodeGitChanges = await this.getChangedFilesFromVsCodeGit();
  if (vscodeGitChanges) {
    return vscodeGitChanges;
  }

  const result = await this.runGit(['status', '--porcelain=v1', '-z']);
  return parsePorcelainStatusZ(result.stdout);
}

import type { CommitDetails } from '../../types';
import type { GitServiceShape } from '.';
import { parseShortStat } from './parseShortStat';

export async function getCommitDetails(this: GitServiceShape, sha: string): Promise<CommitDetails> {
  const [commit] = await this.getGraph(1, 0, { branch: sha });
  const bodyResult = await this.runGit(['show', '--quiet', '--format=%B', sha]);
  const nameStatus = await this.runGit(['show', '--name-status', '--format=', sha]);
  const shortStatResult = await this.runGit(['show', '--shortstat', '--format=', sha]);
  const changedFiles = nameStatus.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status, path };
    });

  const stats = parseShortStat(shortStatResult.stdout);

  return {
    commit: {
      ...commit,
      stats
    },
    body: bodyResult.stdout.trim(),
    changedFiles
  };
}

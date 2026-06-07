import { getConfigValue } from '../../configuration';
import { CommitListView } from '../../views/commitListView';
import type { CommandControllerShape } from './shape';
import { openCommitDetails } from './openCommitDetails';

export async function openBranchCommits(this: CommandControllerShape, branchName: string): Promise<void> {
  await openRefCommits.call(this, `branch:${branchName}`, `Branch: ${branchName}`, branchName);
}

export async function openRefCommits(
  this: CommandControllerShape,
  id: string,
  title: string,
  ref: string
): Promise<void> {
  const maxCommits = Math.max(1, getConfigValue<number>('maxGraphCommits', 200));
  const view = CommitListView.open(
    {
      id,
      title,
      hint: `Showing up to ${maxCommits} commits reachable from ${ref}. Filters update the table locally.`,
      branches: this.state.branches,
      commits: this.state.graph
    },
    {
      openCommitDetails: async (sha, subject) => openCommitDetails.call(this, sha, subject, { allowToggle: true }),
      getCommitFiles: async (sha) => this.git.getFilesInCommit(sha),
      openFileDiff: async (sha, filePath) => this.editor.openCommitFileDiff(sha, filePath)
    }
  );

  view.setLoading(true);
  try {
    await this.state.refreshBranches();
    const commits = await this.git.getGraph(maxCommits, 0, { branch: ref });
    view.update({
      id,
      title,
      hint: `Showing up to ${maxCommits} commits reachable from ${ref}. Filters update the table locally.`,
      branches: this.state.branches,
      commits
    });
  } finally {
    view.setLoading(false);
  }
}

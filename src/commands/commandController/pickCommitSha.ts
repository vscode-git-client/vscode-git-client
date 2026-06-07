import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export async function pickCommitSha(this: CommandControllerShape, title: string): Promise<string | undefined> {
  await this.state.refreshGraph();
  const picked = await vscode.window.showQuickPick(
    this.state.graph.map((commit) => ({
      label: commit.shortSha,
      description: commit.subject,
      detail: `${commit.author} · ${new Date(commit.date).toLocaleString()}`,
      sha: commit.sha
    })),
    { title }
  );

  return picked?.sha;
}

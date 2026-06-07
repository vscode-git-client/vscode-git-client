import * as path from 'path';
import * as vscode from 'vscode';
import type { GitServiceShape } from '.';

export async function getFileContentFromRef(
  this: GitServiceShape,
  refSpec: string,
  relativePath: string
): Promise<string> {
  if (refSpec === 'WORKTREE') {
    try {
      const gitRoot = await this.getGitRoot();
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(gitRoot, relativePath)));
      return Buffer.from(bytes).toString('utf8');
    } catch (error) {
      if (this.isMissingFileContentError(error)) {
        return '';
      }
      throw error;
    }
  }

  try {
    if (refSpec === 'INDEX') {
      const result = await this.runGit(['show', `:${relativePath}`]);
      return result.stdout;
    }

    const result = await this.runGit(['show', `${refSpec}:${relativePath}`]);
    return result.stdout;
  } catch (error) {
    if (this.isMissingFileContentError(error)) {
      return '';
    }
    throw error;
  }
}

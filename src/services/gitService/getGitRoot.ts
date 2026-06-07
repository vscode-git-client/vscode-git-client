import type { GitServiceShape } from '.';

export async function getGitRoot(this: GitServiceShape): Promise<string> {
  if (this._gitRootCache !== undefined) {
    return this._gitRootCache;
  }
  try {
    const result = await this.runGit(['rev-parse', '--show-toplevel']);
    this._gitRootCache = result.stdout.trim();
  } catch {
    this._gitRootCache = this.context.rootPath;
  }
  return this._gitRootCache;
}

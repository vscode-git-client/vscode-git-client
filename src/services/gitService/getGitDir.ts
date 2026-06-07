import * as path from 'path';
import type { GitServiceShape } from '.';

export async function getGitDir(this: GitServiceShape): Promise<string | undefined> {
  if (this._gitDirCache) { return this._gitDirCache; }
  try {
    const result = await this.runGit(['rev-parse', '--git-dir']);
    const raw = result.stdout.trim();
    if (!raw) { return undefined; }
    const resolved = path.isAbsolute(raw) ? raw : path.join(this.gitRoot, raw);
    this._gitDirCache = resolved;
    return resolved;
  } catch {
    return undefined;
  }
}

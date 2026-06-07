import * as path from 'path';
import type { GitServiceShape } from '.';

export function toAbsoluteRepoPath(this: GitServiceShape, relativeOrAbsolutePath: string): string {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(this.gitRoot, relativeOrAbsolutePath);
}

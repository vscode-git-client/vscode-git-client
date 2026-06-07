import * as path from 'path';
import type { GitServiceShape } from '.';

export function toRepoRelative(this: GitServiceShape, absolutePath: string): string | undefined {
  const rel = path.relative(this.gitRoot, absolutePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return undefined;
  }
  return rel.split(path.sep).join('/');
}

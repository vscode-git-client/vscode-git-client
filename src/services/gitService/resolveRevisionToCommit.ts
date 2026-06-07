import type { ResolvedCommitMeta } from '../../types';
import type { GitServiceShape } from '.';

/**
 * Resolves a revision expression (branch name, tag, short SHA, etc.) to
 * a commit and returns its metadata. Returns `undefined` when the ref is
 * invalid or git fails for any reason — this method never throws.
 */
export async function resolveRevisionToCommit(
  this: GitServiceShape,
  input: string
): Promise<ResolvedCommitMeta | undefined> {
  try {
    const verifyResult = await this.runGit(['rev-parse', '--verify', `${input}^{commit}`]);
    const sha = verifyResult.stdout.trim();
    if (!sha) {
      return undefined;
    }

    // Fetch metadata in one log call using NUL separators
    const logResult = await this.runGit([
      'log', '-1', '--format=%H%x00%s%x00%an%x00%ad', '--date=iso-strict', sha
    ]);
    const parts = logResult.stdout.trim().split('\0');
    if (parts.length < 4) {
      return undefined;
    }
    const [resolvedSha, subject, author, date] = parts;
    if (!resolvedSha || !subject || !author || !date) {
      return undefined;
    }
    return { sha: resolvedSha, subject, author, date };
  } catch {
    return undefined;
  }
}

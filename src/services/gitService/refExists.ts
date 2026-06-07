import type { GitServiceShape } from '.';

export async function refExists(this: GitServiceShape, ref: string): Promise<boolean> {
  try {
    await this.runGit(['show-ref', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
}

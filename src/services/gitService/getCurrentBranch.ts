import type { GitServiceShape } from '.';

export async function getCurrentBranch(this: GitServiceShape): Promise<string> {
  const repository = await this.getVsCodeRepository();
  if (repository?.state.HEAD?.name) {
    return repository.state.HEAD.name;
  }
  const result = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.stdout.trim();
}

import type { GitServiceShape } from '.';

export async function getCurrentHeadSha(this: GitServiceShape): Promise<string> {
  const repository = await this.getVsCodeRepository();
  if (repository?.state.HEAD?.commit) {
    return repository.state.HEAD.commit;
  }
  const result = await this.runGit(['rev-parse', 'HEAD']);
  return result.stdout.trim();
}

import type { GitServiceShape } from '.';

export async function addAll(this: GitServiceShape): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git add all');
    await repository.status();
    const paths = this.uniqueChangePaths([
      ...repository.state.mergeChanges,
      ...repository.state.workingTreeChanges,
      ...repository.state.untrackedChanges
    ]);
    if (paths.length > 0) {
      await repository.add(paths);
    }
    return;
  }
  await this.runGit(['add', '-A']);
}

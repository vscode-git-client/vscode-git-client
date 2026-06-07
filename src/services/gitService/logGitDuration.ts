import { getConfigValue } from '../../configuration';
import type { GitServiceShape } from '.';

export function logGitDuration(this: GitServiceShape, command: string, startedAt: number): void {
  const shouldLog = getConfigValue<boolean>('performance.logGitCommands', false);
  const durationMs = Date.now() - startedAt;
  if (shouldLog && durationMs >= 500) {
    this.logger.info(`[perf] git command took ${durationMs}ms: ${command}`);
  }
}

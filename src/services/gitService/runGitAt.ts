import * as cp from 'child_process';
import { getConfigValue } from '../../configuration';
import type { GitCommandResult } from '../../types';
import type { GitServiceShape } from '.';

export async function runGitAt(this: GitServiceShape, cwd: string, args: string[]): Promise<GitCommandResult> {
  const gitPath = getConfigValue<string>('gitPath', 'git');
  const timeoutMs = getConfigValue<number>('commandTimeoutMs', 15000);

  return this.gitCommandQueue.run(() => new Promise<GitCommandResult>((resolve, reject) => {
    const command = `${gitPath} ${args.join(' ')}`;
    const startedAt = Date.now();
    const child = cp.spawn(gitPath, args, { cwd, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      this.logGitDuration(command, startedAt);
      reject(new Error(`Git command timed out: git ${args.join(' ')}`));
    }, timeoutMs);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (error: Error) => {
      clearTimeout(timer);
      this.logGitDuration(command, startedAt);
      reject(error);
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      this.logGitDuration(command, startedAt);
      if (code === 0) { resolve({ stdout, stderr }); return; }
      reject(new Error(stderr || `Git command failed with exit code ${code}`));
    });
  }));
}

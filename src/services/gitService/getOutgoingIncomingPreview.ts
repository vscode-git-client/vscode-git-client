import type { GitServiceShape } from '.';

export async function getOutgoingIncomingPreview(
  this: GitServiceShape
): Promise<{ outgoing: string[]; incoming: string[] }> {
  const branch = await this.getCurrentBranch();
  let upstreamName = '';
  try {
    const upstream = await this.runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`]);
    upstreamName = upstream.stdout.trim();
  } catch {
    return { outgoing: [], incoming: [] };
  }

  const outgoingResult = await this.runGit(['log', '--oneline', `${upstreamName}..${branch}`]);
  const incomingResult = await this.runGit(['log', '--oneline', `${branch}..${upstreamName}`]);

  return {
    outgoing: outgoingResult.stdout.split('\n').map((l) => l.trim()).filter(Boolean),
    incoming: incomingResult.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  };
}

import type { BranchRef } from '../../types';
import { parseTrack } from '../gitParsing';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './constants';

export function parseBranchLines(stdout: string, remoteUrls: Map<string, string>): BranchRef[] {
  return stdout
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, fullName, upstream, track, head, commitEpochRaw] = line.split(FIELD_SEPARATOR);
      const { ahead, behind } = parseTrack(track || '');
      const type: 'local' | 'remote' = fullName.startsWith('refs/remotes/') ? 'remote' : 'local';
      const shortName = type === 'remote' ? name.replace(/^[^/]+\//, '') : name;
      const remoteName = type === 'remote' ? name.split('/')[0] : undefined;
      const commitEpoch = Number.parseInt((commitEpochRaw ?? '').trim(), 10);
      return {
        name,
        shortName,
        fullName,
        type,
        remoteName,
        remoteUrl: remoteName ? remoteUrls.get(remoteName) : undefined,
        upstream: upstream || undefined,
        ahead,
        behind,
        current: head === '*',
        lastCommitEpoch: Number.isNaN(commitEpoch) ? undefined : commitEpoch
      };
    })
    .filter((branch) => {
      // Drop remote root refs like "origin" (no slash).
      return branch.type !== 'remote' || branch.name.includes('/');
    });
}

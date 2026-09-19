export function parseTrack(value: string): { ahead: number; behind: number } {
  if (!value) {
    return { ahead: 0, behind: 0 };
  }

  const aheadMatch = value.match(/ahead (\d+)/);
  const behindMatch = value.match(/behind (\d+)/);
  return {
    ahead: Number(aheadMatch?.[1] ?? 0),
    behind: Number(behindMatch?.[1] ?? 0)
  };
}

export function parseRevListComparison(value: string): { ahead: number; behind: number } {
  const [aheadRaw, behindRaw] = value.trim().split(/\s+/);
  return {
    ahead: Number(aheadRaw ?? 0),
    behind: Number(behindRaw ?? 0)
  };
}

export function formatComparisonSummary(ref: string, ahead: number, behind: number): string {
  return `Compared with ${ref}: ahead ${ahead}, behind ${behind}`;
}

export interface NameStatusEntry {
  readonly status: string;
  readonly path: string;
  readonly oldPath?: string;
}

export interface PorcelainStatusEntry {
  readonly status: string;
  readonly path: string;
}

export function parseNameStatusZ(stdout: string): NameStatusEntry[] {
  if (!stdout) {
    return [];
  }

  const tokens = stdout.split('\0').filter((token) => token.length > 0);
  const entries: NameStatusEntry[] = [];

  for (let index = 0; index < tokens.length;) {
    const statusToken = tokens[index++];
    const status = statusToken[0].toUpperCase();

    if (status === 'R' || status === 'C') {
      // Consume both oldPath and newPath tokens deterministically.
      // Stop safely if either is absent (truncated input).
      const oldPath = tokens[index];
      const newPath = tokens[index + 1];

      if (!oldPath || !newPath) {
        break;
      }

      index += 2;
      entries.push({ status, path: newPath, oldPath });
      continue;
    }

    const path = tokens[index++];
    if (!path) {
      break;
    }

    entries.push({ status, path });
  }

  return entries;
}

/**
 * Converts a remote URL to SSH format. When targetHost is given, the URL's
 * path is rewritten onto that host. When omitted, the host is taken from the
 * URL itself (pure scheme conversion).
 * Returns null if the URL is already SSH (for that host), or cannot be parsed.
 */
export function convertToSshUrl(currentUrl: string, targetHost?: string): string | null {
  const trimmed = currentUrl.trim();
  if (targetHost) {
    if (trimmed.startsWith(`git@${targetHost}:`)) {
      return null;
    }
    const match = trimmed.match(/^https?:\/\/[^/]+\/(.+)$/) ?? trimmed.match(/^git@[^:]+:(.+)$/);
    if (!match) {
      return null;
    }
    return `git@${targetHost}:${match[1]}`;
  }
  // Host inferred from the URL — only meaningful for scheme conversion.
  const scp = trimmed.match(/^([^@/]+)@([^:]+):(.+)$/);
  if (scp) {
    return null; // already scp-style SSH
  }
  const sshUrl = trimmed.match(/^ssh:\/\/(?:([^@/]+)@)?([^/:]+)(?::\d+)?\/(.+)$/);
  if (sshUrl) {
    return null; // already ssh://
  }
  const https = trimmed.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/);
  if (!https) {
    return null;
  }
  return `git@${https[1]}:${https[2]}`;
}

/**
 * Converts a remote URL to HTTPS format. Accepts scp-style (`git@host:path`)
 * and `ssh://git@host[:port]/path` forms; the port is dropped (meaningless
 * for HTTPS). Returns null if the URL is already HTTPS or cannot be parsed.
 */
export function convertToHttpsUrl(currentUrl: string): string | null {
  const trimmed = currentUrl.trim();
  const scp = trimmed.match(/^(?:[^@/]+)@([^:]+):(.+)$/);
  if (scp && !/^https?:\/\//.test(trimmed)) {
    return `https://${scp[1]}/${scp[2]}`;
  }
  const sshUrl = trimmed.match(/^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/);
  if (sshUrl) {
    return `https://${sshUrl[1]}/${sshUrl[2]}`;
  }
  if (/^https?:\/\//.test(trimmed)) {
    return null;
  }
  return null;
}

/** Classifies a remote URL by transport scheme, for UI hints. */
export function detectUrlScheme(url: string): 'ssh' | 'https' | 'other' {
  const trimmed = url.trim();
  if (/^https?:\/\//.test(trimmed)) {
    return 'https';
  }
  if (/^ssh:\/\//.test(trimmed) || /^[^@/\s]+@[^:\s]+:(?!\/\/)/.test(trimmed)) {
    return 'ssh';
  }
  return 'other';
}

export function parsePorcelainStatusZ(stdout: string): PorcelainStatusEntry[] {
  if (!stdout) {
    return [];
  }

  const tokens = stdout.split('\0').filter((token) => token.length > 0);
  const entries: PorcelainStatusEntry[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 4) {
      continue;
    }

    const status = token.slice(0, 2);
    const path = token.slice(3);
    const statusCode = status.trim()[0]?.toUpperCase();

    if (statusCode === 'R' || statusCode === 'C') {
      // `git status --porcelain=v1 -z` emits renames/copies as
      // `XY <new>\0<old>\0` — the destination is in the status token,
      // followed by the source in the next token. Keep `path` (new)
      // and consume the trailing source token.
      const origPath = tokens[index + 1];
      if (!origPath) {
        break;
      }
      entries.push({ status, path });
      index += 1;
      continue;
    }

    entries.push({ status, path });
  }

  return entries;
}

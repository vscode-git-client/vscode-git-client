import * as fs from 'fs/promises';
import * as path from 'path';

export type WorktreeTargetPathResult =
  | { readonly ok: true; readonly targetPath: string }
  | { readonly ok: false; readonly message: string };

export function buildDefaultWorktreeDirectoryName(currentWorktreePath: string, refName: string): string {
  const currentName = normalizeWorktreePathSegment(path.basename(currentWorktreePath));
  const refSegment = normalizeWorktreePathSegment(refName);
  return `${currentName}-${refSegment}`;
}

export function normalizeWorktreePathSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/^refs\/(?:heads|remotes|tags)\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return normalized || 'worktree';
}

export async function resolveWorktreeTargetPath(
  selectedFolderPath: string,
  currentWorktreePath: string,
  refName: string
): Promise<WorktreeTargetPathResult> {
  let entries: string[];
  try {
    entries = await fs.readdir(selectedFolderPath);
  } catch (error) {
    return {
      ok: false,
      message: `Cannot read selected folder: ${formatErrorMessage(error)}`
    };
  }

  if (entries.length === 0) {
    return { ok: true, targetPath: selectedFolderPath };
  }

  const targetPath = path.join(
    selectedFolderPath,
    buildDefaultWorktreeDirectoryName(currentWorktreePath, refName)
  );

  try {
    await fs.lstat(targetPath);
    return {
      ok: false,
      message: `Worktree destination already exists or contains data: ${targetPath}`
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { ok: true, targetPath };
    }

    return {
      ok: false,
      message: `Cannot check worktree destination: ${formatErrorMessage(error)}`
    };
  }
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

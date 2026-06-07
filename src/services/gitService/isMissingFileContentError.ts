export function isMissingFileContentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /EntryNotFound|ENOENT|no such file or directory/i.test(message) ||
    /does not exist in|exists on disk, but not in|not in the index/i.test(message)
  );
}

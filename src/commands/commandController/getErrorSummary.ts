export function getErrorSummary(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? 'Unknown git error.';
}

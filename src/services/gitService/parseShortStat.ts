export function parseShortStat(raw: string): { files: number; insertions: number; deletions: number } | undefined {
  const line = raw
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0);

  if (!line) {
    return undefined;
  }

  const filesMatch = line.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = line.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = line.match(/(\d+)\s+deletions?\(-\)/);

  return {
    files: Number(filesMatch?.[1] ?? 0),
    insertions: Number(insertionsMatch?.[1] ?? 0),
    deletions: Number(deletionsMatch?.[1] ?? 0)
  };
}

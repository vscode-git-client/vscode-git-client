import type { TagRef } from '../../types';

export function mergeTagAvailability(
  tags: readonly TagRef[],
  availability: ReadonlyMap<string, ReadonlySet<string>>
): TagRef[] {
  return tags.map((tag) => ({
    ...tag,
    availableOnRemotes: Array.from(availability.get(tag.name) ?? []).sort((a, b) =>
      a.localeCompare(b)
    )
  }));
}

import type { TagRef } from '../../types';
import type { GitServiceShape } from '.';
import { mergeTagAvailability } from './mergeTagAvailability';

export async function getTags(this: GitServiceShape): Promise<TagRef[]> {
  const [basic, availability] = await Promise.all([
    this.getTagsBasic(),
    this.getTagAvailabilityByRemote()
  ]);
  return mergeTagAvailability(basic, availability);
}

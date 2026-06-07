import type { GutterDecorationControllerShape } from './index';

export async function refreshHeadSha(this: GutterDecorationControllerShape): Promise<boolean> {
  try {
    const sha = await this.gitService.getCurrentHeadSha();
    if (sha !== this.currentHeadSha) {
      this.currentHeadSha = sha;
      this.headCache.clear();
      return true;
    }
  } catch {
    const changed = this.currentHeadSha !== '';
    this.currentHeadSha = '';
    this.headCache.clear();
    return changed;
  }
  return false;
}

import type { GutterDecorationControllerShape } from './index';

export function dispose(this: GutterDecorationControllerShape): void {
  for (const d of this.disposables) {
    d.dispose();
  }
  this.decorations.added.dispose();
  this.decorations.modified.dispose();
  this.decorations.removed.dispose();
}

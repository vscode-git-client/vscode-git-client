import * as vscode from 'vscode';
import type { GutterDecorationControllerShape } from './index';

export async function getHeadContent(
  this: GutterDecorationControllerShape,
  uri: vscode.Uri,
  relativePath: string
): Promise<string | null> {
  const key = uri.toString();
  const cached = this.headCache.get(key);
  if (cached && cached.headSha === this.currentHeadSha && cached.relativePath === relativePath) {
    return cached.content;
  }
  let content: string | null;
  try {
    content = await this.gitService.getFileContentFromRef('HEAD', relativePath);
  } catch {
    content = null;
  }
  this.headCache.set(key, { headSha: this.currentHeadSha, relativePath, content });
  return content;
}

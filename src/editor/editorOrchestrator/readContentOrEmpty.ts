import type { EditorOrchestratorShape } from './index';

export async function readContentOrEmpty(
  this: EditorOrchestratorShape,
  ref: string,
  relativePath: string
): Promise<string> {
  try {
    return await this.git.getFileContentFromRef(ref, relativePath);
  } catch {
    return '';
  }
}

import * as vscode from 'vscode';
import { isGeneratedPath, shouldSkipGutterDocument } from '../gutterGuards';
import type { GutterDecorationControllerShape } from './index';

export async function shouldSkipDocument(
  this: GutterDecorationControllerShape,
  doc: vscode.TextDocument,
  relativePath: string
): Promise<boolean> {
  if (isGeneratedPath(relativePath)) {
    return true;
  }

  try {
    const stat = await vscode.workspace.fs.stat(doc.uri);
    return shouldSkipGutterDocument(doc.lineCount, stat.size, this.maxLineCount, this.maxFileSizeKb);
  } catch {
    return shouldSkipGutterDocument(doc.lineCount, 0, this.maxLineCount, this.maxFileSizeKb);
  }
}

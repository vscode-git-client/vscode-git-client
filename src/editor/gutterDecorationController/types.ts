import * as vscode from 'vscode';

export type DecorationSet = {
  added: vscode.TextEditorDecorationType;
  modified: vscode.TextEditorDecorationType;
  removed: vscode.TextEditorDecorationType;
};

export type HeadCacheEntry = {
  headSha: string;
  relativePath: string;
  content: string | null; // null means file did not exist in HEAD
};

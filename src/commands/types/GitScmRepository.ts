import type * as vscode from 'vscode';

export type GitScmRepository = {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
};

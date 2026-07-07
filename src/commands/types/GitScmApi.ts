import type { GitScmRepository } from "./GitScmRepository";
import type * as vscode from "vscode";

export type GitScmApi = {
  repositories: GitScmRepository[];
  getRepository(uri: vscode.Uri): GitScmRepository | null;
};
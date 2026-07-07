import * as vscode from 'vscode';
import { GitCommand } from '../config/commands';
import { Logger } from '../logger';
import { TextCompareOrchestrator } from '../editor/textCompareOrchestrator';

export function registerTextCompareCommands(
  context: vscode.ExtensionContext,
  logger: Logger,
  textCompare: TextCompareOrchestrator
): void {
  const asFileResourceUri = (value: unknown): vscode.Uri | undefined => {
    if (value instanceof vscode.Uri) {
      return value.scheme === 'file' ? value : undefined;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'resourceUri' in value &&
      (value as { resourceUri?: unknown }).resourceUri instanceof vscode.Uri
    ) {
      const uri = (value as { resourceUri: vscode.Uri }).resourceUri;
      return uri.scheme === 'file' ? uri : undefined;
    }

    return undefined;
  };

  const register = (command: string, callback: (...args: unknown[]) => Promise<void>): void => {
    const run = async (...args: unknown[]): Promise<void> => {
      try {
        await callback(...args);
      } catch (error) {
        logger.error(`Command failed: ${command}`, error);
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`VS Code Git Client: ${message}`);
      }
    };
    context.subscriptions.push(vscode.commands.registerCommand(command, run));
  };

  register(GitCommand.TextCompareOpen, async (arg?: unknown) => {
    const seedFile = asFileResourceUri(arg);
    await textCompare.open(seedFile ? { seedFile } : {});
  });

  register('intelliGit.textCompare.open', async (...args: unknown[]) => {
    await vscode.commands.executeCommand(GitCommand.TextCompareOpen, ...args);
  });
}

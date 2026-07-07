import * as assert from 'assert';
import { afterEach, describe, it } from 'node:test';
import * as vscode from 'vscode';
import { registerTextCompareCommands } from '../commands/textCompareCommands';
import { TextCompareOrchestrator } from '../editor/textCompareOrchestrator';
import { Logger } from '../logger';

describe('registerTextCompareCommands', () => {
  const originalRegisterCommand = vscode.commands.registerCommand;
  const originalExecuteCommand = vscode.commands.executeCommand;
  const originalShowErrorMessage = vscode.window.showErrorMessage;

  afterEach(() => {
    (
      vscode.commands as unknown as { registerCommand: typeof vscode.commands.registerCommand }
    ).registerCommand = originalRegisterCommand;
    (
      vscode.commands as unknown as { executeCommand: typeof vscode.commands.executeCommand }
    ).executeCommand = originalExecuteCommand;
    (
      vscode.window as unknown as { showErrorMessage: typeof vscode.window.showErrorMessage }
    ).showErrorMessage = originalShowErrorMessage;
  });

  it('registers vscodeGitClient.textCompare.open and its legacy alias', () => {
    const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const disposables: vscode.Disposable[] = [];

    (
      vscode.commands as unknown as {
        registerCommand: typeof vscode.commands.registerCommand;
      }
    ).registerCommand = (command: string, callback: (...args: unknown[]) => Promise<unknown>) => {
      registered.set(command, callback);
      const disposable = {
        dispose: () => {
          /* no-op */
        }
      };
      disposables.push(disposable);
      return disposable;
    };

    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;
    const logger = {
      error: () => {
        /* no-op */
      },
      warn: () => {
        /* no-op */
      },
      info: () => {
        /* no-op */
      },
      dispose: () => {
        /* no-op */
      }
    } as unknown as Logger;
    const textCompare = new TextCompareOrchestrator();

    registerTextCompareCommands(context, logger, textCompare);

    assert.strictEqual(registered.has('vscodeGitClient.textCompare.open'), true);
    assert.strictEqual(registered.has('intelliGit.textCompare.open'), true);
    assert.strictEqual(context.subscriptions.length, 2);
  });

  it('routes legacy alias to the primary command', async () => {
    const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const executed: Array<{ command: string; args: unknown[] }> = [];

    (
      vscode.commands as unknown as {
        registerCommand: typeof vscode.commands.registerCommand;
      }
    ).registerCommand = (command: string, callback: (...args: unknown[]) => Promise<unknown>) => {
      registered.set(command, callback);
      return {
        dispose: () => {
          /* no-op */
        }
      };
    };

    (vscode.commands as any).executeCommand = async (command: string, ...args: unknown[]) => {
      executed.push({ command, args });
    };

    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;
    const logger = {
      error: () => {
        /* no-op */
      },
      warn: () => {
        /* no-op */
      },
      info: () => {
        /* no-op */
      },
      dispose: () => {
        /* no-op */
      }
    } as unknown as Logger;
    const textCompare = new TextCompareOrchestrator();

    registerTextCompareCommands(context, logger, textCompare);

    const legacyHandler = registered.get('intelliGit.textCompare.open');
    assert.ok(legacyHandler);
    const seed = vscode.Uri.file('/workspace/a.txt');
    await legacyHandler!(seed);
    assert.deepStrictEqual(executed, [
      { command: 'vscodeGitClient.textCompare.open', args: [seed] }
    ]);
  });

  it('shows an error message when the primary command handler throws', async () => {
    const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const errors: string[] = [];

    (
      vscode.commands as unknown as {
        registerCommand: typeof vscode.commands.registerCommand;
      }
    ).registerCommand = (command: string, callback: (...args: unknown[]) => Promise<unknown>) => {
      registered.set(command, callback);
      return {
        dispose: () => {
          /* no-op */
        }
      };
    };

    (
      vscode.window as unknown as {
        showErrorMessage: typeof vscode.window.showErrorMessage;
      }
    ).showErrorMessage = async (message: string) => {
      errors.push(message);
      return undefined;
    };

    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;
    const logger = {
      error: () => {
        /* no-op */
      },
      warn: () => {
        /* no-op */
      },
      info: () => {
        /* no-op */
      },
      dispose: () => {
        /* no-op */
      }
    } as unknown as Logger;
    const textCompare = {
      open: async () => {
        throw new Error('boom');
      }
    } as unknown as TextCompareOrchestrator;

    registerTextCompareCommands(context, logger, textCompare);

    const handler = registered.get('vscodeGitClient.textCompare.open');
    assert.ok(handler);
    await handler!();
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes('boom'));
  });
});

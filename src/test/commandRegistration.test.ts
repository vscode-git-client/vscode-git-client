import * as assert from 'assert';
import { afterEach, describe, it } from 'node:test';
import * as vscode from 'vscode';
import { GitCommand, GIT_COMMAND_PREFIX } from '../config/commands';
import { CommandController } from '../commands/commandController';
import { registerTextCompareCommands } from '../commands/textCompareCommands';
import { TextCompareOrchestrator } from '../editor/textCompareOrchestrator';
import pkg from '../../package.json';

/** Every command string declared in package.json contributes.commands. */
const pkgCommands = new Set(pkg.contributes.commands.map((c: { command: string }) => c.command));

/**
 * The subset of GitCommand enum entries whose values appear in package.json's
 * contributes.commands array.  These are the entries that represent actual
 * user-facing commands (as opposed to view ids, context keys, etc.).
 */
function filterCommandEnumEntries(): Array<[string, string]> {
  return Object.entries(GitCommand).filter(([, value]) => pkgCommands.has(value));
}

describe('Command Registration', () => {
  // ── 1. Enum coverage ───────────────────────────────────────────────────

  it('every command in package.json has a corresponding GitCommand enum entry', () => {
    const enumValues = new Set(Object.values(GitCommand));
    const missing: string[] = [];
    for (const cmd of pkgCommands) {
      if (!enumValues.has(cmd as GitCommand)) {
        missing.push(cmd);
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `package.json commands missing from GitCommand enum (${missing.length}):\n${missing.join('\n')}`
    );
  });

  // ── 2. CommandController registration ──────────────────────────────────

  describe('CommandController.register()', () => {
    let originalRegisterCommand: typeof vscode.commands.registerCommand;

    afterEach(() => {
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = originalRegisterCommand;
    });

    it('registers every CommandController-managed command with a callback', () => {
      originalRegisterCommand = vscode.commands.registerCommand;

      const registered = new Map<string, (...args: unknown[]) => unknown>();
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = (command: string, callback: (...args: unknown[]) => unknown) => {
        registered.set(command, callback);
        return { dispose: () => {} };
      };

      const controller = new CommandController(
        {} as unknown as Parameters<(typeof CommandController.prototype)['register']> extends []
          ? never
          : never,

        {} as any,

        {} as any,
        {
          error: () => {},
          warn: () => {},
          info: () => {},
          dispose: () => {}
        } as any,

        {} as any
      );

      const context = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      controller.register(context);

      const commandEntries = filterCommandEnumEntries();

      // TextCompareOpen is registered by registerTextCompareCommands, not
      // CommandController, so exclude it from this check.
      const managedCommands = commandEntries.filter(
        ([, value]) => value !== GitCommand.TextCompareOpen
      );

      const unregistered: string[] = [];
      for (const [name, cmdValue] of managedCommands) {
        if (!registered.has(cmdValue)) {
          unregistered.push(`${name} (${cmdValue})`);
          continue;
        }
        const callback = registered.get(cmdValue);
        if (typeof callback !== 'function') {
          unregistered.push(`${name} (${cmdValue}) — registered but callback is not a function`);
        }
      }

      assert.deepStrictEqual(
        unregistered,
        [],
        `Commands not registered with a callback via CommandController (${unregistered.length}):\n${unregistered.join('\n')}`
      );
    });

    it('registers legacy intelliGit aliases for every command', () => {
      originalRegisterCommand = vscode.commands.registerCommand;

      const registered = new Map<string, (...args: unknown[]) => unknown>();
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = (command: string, callback: (...args: unknown[]) => unknown) => {
        registered.set(command, callback);
        return { dispose: () => {} };
      };

      const controller = new CommandController(
        {} as any,

        {} as any,

        {} as any,
        {
          error: () => {},
          warn: () => {},
          info: () => {},
          dispose: () => {}
        } as any,

        {} as any
      );

      const context = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      controller.register(context);

      const commandEntries = filterCommandEnumEntries().filter(
        ([, value]) => value !== GitCommand.TextCompareOpen
      );

      const missingLegacy: string[] = [];
      for (const [name, cmdValue] of commandEntries) {
        const expectedLegacy = `intelliGit.${cmdValue.slice(GIT_COMMAND_PREFIX.length)}`;
        if (!registered.has(expectedLegacy)) {
          missingLegacy.push(`${name} → ${expectedLegacy}`);
        }
      }

      assert.deepStrictEqual(
        missingLegacy,
        [],
        `Commands missing legacy intelliGit alias (${missingLegacy.length}):\n${missingLegacy.join('\n')}`
      );
    });

    it('pushes disposables into context.subscriptions', () => {
      originalRegisterCommand = vscode.commands.registerCommand;

      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = () => ({ dispose: () => {} });

      const controller = new CommandController(
        {} as any,

        {} as any,

        {} as any,
        {
          error: () => {},
          warn: () => {},
          info: () => {},
          dispose: () => {}
        } as any,

        {} as any
      );

      const context = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      controller.register(context);

      // Every command plus its legacy alias should produce at least one disposable.
      // Total should be >= number of managed commands (including both primary + legacy).
      const managedCount = filterCommandEnumEntries().filter(
        ([, value]) => value !== GitCommand.TextCompareOpen
      ).length;
      const expectedMin = managedCount + managedCount; // primary + legacy per command
      assert.ok(
        context.subscriptions.length >= expectedMin,
        `Expected at least ${expectedMin} disposables (primary + legacy per command), got ${context.subscriptions.length}`
      );
    });
  });

  // ── 3. TextCompareCommands registration ────────────────────────────────

  describe('registerTextCompareCommands()', () => {
    let originalRegisterCommand: typeof vscode.commands.registerCommand;

    afterEach(() => {
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = originalRegisterCommand;
    });

    it('registers textCompare.open with a callback', () => {
      originalRegisterCommand = vscode.commands.registerCommand;

      const registered = new Map<string, (...args: unknown[]) => unknown>();
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = (command: string, callback: (...args: unknown[]) => unknown) => {
        registered.set(command, callback);
        return { dispose: () => {} };
      };

      const context = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      const logger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        dispose: () => {}
      } as any;
      const textCompare = new TextCompareOrchestrator();

      registerTextCompareCommands(context, logger, textCompare);

      assert.ok(
        registered.has(GitCommand.TextCompareOpen),
        'TextCompareOpen command was not registered'
      );
      assert.strictEqual(
        typeof registered.get(GitCommand.TextCompareOpen),
        'function',
        'TextCompareOpen callback is not a function'
      );

      // Verify subscriptions are added
      assert.ok(context.subscriptions.length > 0, 'No subscriptions were added to context');
    });
  });

  // ── 4. No duplicate command IDs across registration paths ───────────────

  it('CommandController and textCompareCommands do not register overlapping commands', () => {
    const originalRegisterCommand = vscode.commands.registerCommand;

    const registered = new Set<string>();
    (
      vscode.commands as unknown as {
        registerCommand: typeof vscode.commands.registerCommand;
      }
    ).registerCommand = (command: string) => {
      if (registered.has(command)) {
        assert.fail(`Duplicate registration for command: ${command}`);
      }
      registered.add(command);
      return { dispose: () => {} };
    };

    try {
      const controller = new CommandController(
        {} as any,

        {} as any,

        {} as any,
        {
          error: () => {},
          warn: () => {},
          info: () => {},
          dispose: () => {}
        } as any,

        {} as any
      );

      const context1 = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      controller.register(context1);

      const context2 = {
        subscriptions: [] as vscode.Disposable[]
      } as vscode.ExtensionContext;
      const logger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        dispose: () => {}
      } as any;
      const textCompare = new TextCompareOrchestrator();
      registerTextCompareCommands(context2, logger, textCompare);
    } finally {
      (
        vscode.commands as unknown as {
          registerCommand: typeof vscode.commands.registerCommand;
        }
      ).registerCommand = originalRegisterCommand;
    }
  });
});

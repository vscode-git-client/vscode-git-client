import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { formatTextCompareTitle, TextCompareSession } from '../editor/textCompareSession';

describe('formatTextCompareTitle', () => {
  it('combines two labels with the compare glyph', () => {
    assert.strictEqual(formatTextCompareTitle('foo.txt', 'bar.txt'), 'foo.txt ↔ bar.txt · Text Compare');
  });

  it('treats empty labels as empty strings', () => {
    assert.strictEqual(formatTextCompareTitle('', 'Clipboard'), ' ↔ Clipboard · Text Compare');
  });
});

describe('TextCompareSession', () => {
  it('creates a session and opens vscode.diff', async () => {
    const originalExecuteCommand = vscode.commands.executeCommand;
    const calls: unknown[] = [];
    (vscode.commands as any).executeCommand = async (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      const session = await TextCompareSession.create(
        { kind: 'empty', content: '', label: 'Left' },
        { kind: 'empty', content: '', label: 'Right' }
      );
      assert.ok(session);
      assert.strictEqual(calls.length, 1);
      const firstCall = calls[0] as unknown[];
      assert.strictEqual(firstCall[0], 'vscode.diff');
      assert.strictEqual(firstCall[3], 'Left ↔ Right · Text Compare');
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
    }
  });

  it('disposes when neither side is visible', async () => {
    const originalTabGroups = vscode.window.tabGroups;
    (vscode.window as any).tabGroups = {
      all: [],
      onDidChangeTabs: () => ({ dispose: () => undefined })
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async () => undefined;

    try {
      const session = await TextCompareSession.create(
        { kind: 'empty', content: '', label: 'Left' },
        { kind: 'empty', content: '', label: 'Right' }
      );
      assert.ok(session);
      assert.strictEqual((session as any).disposed, true);
    } finally {
      (vscode.window as any).tabGroups = originalTabGroups;
      (vscode.commands as any).executeCommand = originalExecuteCommand;
    }
  });
});

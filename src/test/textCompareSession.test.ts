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

  it('survives mismatched standalone tabs during initial open and disposes after settling', async () => {
    const leftUri = { scheme: 'untitled', toString: () => 'untitled:left' } as vscode.Uri;
    const rightUri = { scheme: 'untitled', toString: () => 'untitled:right' } as vscode.Uri;

    const DiffInput = vscode.TabInputTextDiff as unknown as new (o: vscode.Uri, m: vscode.Uri) => { original: vscode.Uri; modified: vscode.Uri };
    const TextInput = vscode.TabInputText as unknown as new (u: vscode.Uri) => { uri: vscode.Uri };
    const diffInput = new DiffInput(leftUri, rightUri);
    const standaloneInput = new TextInput(leftUri);

    const originalTabGroups = vscode.window.tabGroups;
    const originalShowTextDocument = (vscode.window as any).showTextDocument;
    (vscode.window as any).showTextDocument = async () => undefined;
    (vscode.window as any).tabGroups = {
      all: [
        {
          tabs: [
            { input: diffInput },
            { input: standaloneInput }
          ]
        }
      ],
      onDidChangeTabs: () => ({ dispose: () => undefined }),
      close: async () => undefined
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async () => undefined;

    const mocks = vscode.workspace as any;
    const originalOpenTextDocument = mocks.openTextDocument;
    let callCount = 0;
    mocks.openTextDocument = async (options: unknown) => {
      callCount += 1;
      const uri = callCount === 1 ? leftUri : rightUri;
      const doc = { uri, getText: () => '' } as unknown as vscode.TextDocument;
      mocks.textDocuments = [...(mocks.textDocuments || []), doc];
      return doc;
    };

    try {
      const session = await TextCompareSession.create(
        { kind: 'empty', content: '', label: 'Left' },
        { kind: 'empty', content: '', label: 'Right' }
      );
      assert.ok(session);
      assert.strictEqual((session as any).disposed, false);
      assert.strictEqual((session as any).sessionSettled, true);

      await (session as any).disposeIfHidden();
      assert.strictEqual((session as any).disposed, true);
    } finally {
      (vscode.window as any).tabGroups = originalTabGroups;
      (vscode.window as any).showTextDocument = originalShowTextDocument;
      (vscode.commands as any).executeCommand = originalExecuteCommand;
      mocks.openTextDocument = originalOpenTextDocument;
    }
  });

  it('does not close the session when a tab merely changes (e.g. dirty state from typing)', async () => {
    const leftUri = { scheme: 'untitled', toString: () => 'untitled:left' } as vscode.Uri;
    const rightUri = { scheme: 'untitled', toString: () => 'untitled:right' } as vscode.Uri;

    const DiffInput = vscode.TabInputTextDiff as unknown as new (o: vscode.Uri, m: vscode.Uri) => { original: vscode.Uri; modified: vscode.Uri };
    const diffInput = new DiffInput(leftUri, rightUri);
    const diffTab = { input: diffInput, isDirty: false };

    let changeListener: ((event: { opened: unknown[]; closed: unknown[]; changed: unknown[] }) => void) | undefined;

    const originalTabGroups = vscode.window.tabGroups;
    const originalShowTextDocument = (vscode.window as any).showTextDocument;
    (vscode.window as any).showTextDocument = async () => undefined;
    (vscode.window as any).tabGroups = {
      all: [
        {
          tabs: [diffTab]
        }
      ],
      onDidChangeTabs: (listener: (event: { opened: unknown[]; closed: unknown[]; changed: unknown[] }) => void) => {
        changeListener = listener;
        return { dispose: () => undefined };
      },
      close: async () => undefined
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async () => undefined;

    const mocks = vscode.workspace as any;
    const originalOpenTextDocument = mocks.openTextDocument;
    let callCount = 0;
    mocks.openTextDocument = async () => {
      callCount += 1;
      const uri = callCount === 1 ? leftUri : rightUri;
      const doc = { uri, getText: () => '' } as unknown as vscode.TextDocument;
      mocks.textDocuments = [...(mocks.textDocuments || []), doc];
      return doc;
    };

    try {
      const session = await TextCompareSession.create(
        { kind: 'empty', content: '', label: 'Left' },
        { kind: 'empty', content: '', label: 'Right' }
      );
      assert.ok(session);
      assert.strictEqual((session as any).disposed, false);

      // Simulate the user pasting text into the left side: VS Code flips the tab's
      // dirty state and reports it via `changed`, not `closed`.
      diffTab.isDirty = true;
      assert.ok(changeListener);
      await changeListener!({ opened: [], closed: [], changed: [diffTab] });

      assert.strictEqual((session as any).disposed, false);
    } finally {
      (vscode.window as any).tabGroups = originalTabGroups;
      (vscode.window as any).showTextDocument = originalShowTextDocument;
      (vscode.commands as any).executeCommand = originalExecuteCommand;
      mocks.openTextDocument = originalOpenTextDocument;
    }
  });

  it('survives the tab-registration race where tabGroups.all lags behind vscode.diff resolving', async () => {
    const leftUri = { scheme: 'untitled', toString: () => 'untitled:left' } as vscode.Uri;
    const rightUri = { scheme: 'untitled', toString: () => 'untitled:right' } as vscode.Uri;

    const DiffInput = vscode.TabInputTextDiff as unknown as new (o: vscode.Uri, m: vscode.Uri) => { original: vscode.Uri; modified: vscode.Uri };
    const diffInput = new DiffInput(leftUri, rightUri);
    const diffTab = { input: diffInput, isDirty: false };

    // Simulate VS Code's tab-model bookkeeping lagging behind the `vscode.diff`
    // command's promise resolution: `tabGroups.all` reports no tabs at all for the
    // first few reads, then "catches up" and reflects the new diff tab.
    let readCount = 0;
    const originalTabGroups = vscode.window.tabGroups;
    const originalShowTextDocument = (vscode.window as any).showTextDocument;
    (vscode.window as any).showTextDocument = async () => undefined;
    (vscode.window as any).tabGroups = {
      get all() {
        readCount += 1;
        return readCount <= 3 ? [] : [{ tabs: [diffTab] }];
      },
      onDidChangeTabs: () => ({ dispose: () => undefined }),
      close: async () => undefined
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async () => undefined;

    const mocks = vscode.workspace as any;
    const originalOpenTextDocument = mocks.openTextDocument;
    let callCount = 0;
    mocks.openTextDocument = async () => {
      callCount += 1;
      const uri = callCount === 1 ? leftUri : rightUri;
      const doc = { uri, getText: () => '' } as unknown as vscode.TextDocument;
      mocks.textDocuments = [...(mocks.textDocuments || []), doc];
      return doc;
    };

    try {
      const session = await TextCompareSession.create(
        { kind: 'empty', content: '', label: 'Left' },
        { kind: 'empty', content: '', label: 'Right' }
      );
      assert.ok(session);
      // The diff tab genuinely is (or will imminently be) registered — the session
      // must not have torn itself down just because the first few reads raced ahead
      // of VS Code's bookkeeping.
      assert.strictEqual((session as any).disposed, false);
    } finally {
      (vscode.window as any).tabGroups = originalTabGroups;
      (vscode.window as any).showTextDocument = originalShowTextDocument;
      (vscode.commands as any).executeCommand = originalExecuteCommand;
      mocks.openTextDocument = originalOpenTextDocument;
    }
  });
});

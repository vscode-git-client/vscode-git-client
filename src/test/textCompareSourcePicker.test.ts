import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { pickTextCompareSource, buildSourcePickerItems } from '../editor/textCompareSourcePicker';

describe('buildSourcePickerItems', () => {
  it('returns Open file, Paste from Clipboard, and Empty text items', () => {
    const items = buildSourcePickerItems();
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].label, '$(file) Open file...');
    assert.strictEqual(items[1].label, '$(clippy) Paste from Clipboard');
    assert.strictEqual(items[2].label, '$(circle-outline) Empty text');
  });

  it('assigns stable kind identifiers', () => {
    const items = buildSourcePickerItems();
    assert.deepStrictEqual(
      items.map((item) => item.sourceKind),
      ['file', 'clipboard', 'empty']
    );
  });
});

describe('pickTextCompareSource', () => {
  it('returns undefined when the user cancels the picker', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    vscode.window.showQuickPick = async () => undefined;

    try {
      const result = await pickTextCompareSource('left');
      assert.strictEqual(result, undefined);
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
    }
  });

  it('returns file source when a file is selected', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;

    const uri = vscode.Uri.file('/workspace/foo.ts');
    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'file', label: '$(file) Open file...' }) as any;
    vscode.window.showOpenDialog = async () => [uri];
    vscode.workspace.openTextDocument = async () => ({ getText: () => 'hello' }) as any;

    try {
      const result = await pickTextCompareSource('left');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'file');
      assert.strictEqual(result!.uri.toString(), uri.toString());
      assert.strictEqual(result!.content, 'hello');
      assert.strictEqual(result!.label, 'foo.ts');
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
      vscode.window.showOpenDialog = originalShowOpenDialog;
      vscode.workspace.openTextDocument = originalOpenTextDocument;
    }
  });

  it('returns undefined when the file dialog is cancelled', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;

    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'file', label: '$(file) Open file...' }) as any;
    vscode.window.showOpenDialog = async () => undefined;

    try {
      const result = await pickTextCompareSource('left');
      assert.strictEqual(result, undefined);
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
      vscode.window.showOpenDialog = originalShowOpenDialog;
    }
  });

  it('throws a contextual error when the file cannot be read', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;

    const uri = vscode.Uri.file('/workspace/missing.ts');
    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'file', label: '$(file) Open file...' }) as any;
    vscode.window.showOpenDialog = async () => [uri];
    vscode.workspace.openTextDocument = async () => {
      throw new Error('ENOENT');
    };

    try {
      await assert.rejects(async () => pickTextCompareSource('left'), /Failed to read file/);
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
      vscode.window.showOpenDialog = originalShowOpenDialog;
      vscode.workspace.openTextDocument = originalOpenTextDocument;
    }
  });

  it('uses the workspace root as the file dialog default URI', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    const workspaceRoot = vscode.Uri.file('/workspace');
    (vscode.workspace as any).workspaceFolders = [
      { uri: workspaceRoot, name: 'workspace', index: 0 } as any
    ];
    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'file', label: '$(file) Open file...' }) as any;

    let passedDefaultUri: vscode.Uri | undefined;
    vscode.window.showOpenDialog = async (options) => {
      passedDefaultUri = options?.defaultUri;
      return [vscode.Uri.file('/workspace/foo.ts')];
    };
    vscode.workspace.openTextDocument = async () => ({ getText: () => 'hello' }) as any;

    try {
      await pickTextCompareSource('left');
      assert.ok(passedDefaultUri);
      assert.strictEqual(passedDefaultUri!.toString(), workspaceRoot.toString());
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
      vscode.window.showOpenDialog = originalShowOpenDialog;
      vscode.workspace.openTextDocument = originalOpenTextDocument;
      (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    }
  });

  it('returns clipboard source', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalReadClipboard = vscode.env.clipboard.readText;

    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'clipboard', label: '$(clippy) Paste from Clipboard' }) as any;
    vscode.env.clipboard.readText = async () => 'clipboard text';

    try {
      const result = await pickTextCompareSource('left');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'clipboard');
      assert.strictEqual(result!.content, 'clipboard text');
      assert.strictEqual(result!.label, 'Clipboard');
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
      vscode.env.clipboard.readText = originalReadClipboard;
    }
  });

  it('returns empty source', async () => {
    const originalShowQuickPick = vscode.window.showQuickPick;

    vscode.window.showQuickPick = async () =>
      ({ sourceKind: 'empty', label: '$(circle-outline) Empty text' }) as any;

    try {
      const result = await pickTextCompareSource('left');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'empty');
      assert.strictEqual(result!.content, '');
      assert.strictEqual(result!.label, 'Empty');
    } finally {
      vscode.window.showQuickPick = originalShowQuickPick;
    }
  });
});

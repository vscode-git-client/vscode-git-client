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
    assert.strictEqual(items[2].label, '$(empty) Empty text');
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
});

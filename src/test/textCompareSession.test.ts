import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { formatTextCompareTitle } from '../editor/textCompareSession';

describe('formatTextCompareTitle', () => {
  it('combines two labels with the compare glyph', () => {
    assert.strictEqual(formatTextCompareTitle('foo.txt', 'bar.txt'), 'foo.txt ↔ bar.txt · Text Compare');
  });

  it('treats empty labels as empty strings', () => {
    assert.strictEqual(formatTextCompareTitle('', 'Clipboard'), ' ↔ Clipboard · Text Compare');
  });
});

describe('untitled document URI scheme', () => {
  it('uses the untitled scheme for an in-memory document', async () => {
    const document = await vscode.workspace.openTextDocument({ content: 'hello' });
    assert.strictEqual(document.uri.scheme, 'untitled');
  });
});

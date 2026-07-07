import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { getSourceLabel, getLanguageForFile } from '../editor/textCompareSource';

describe('getSourceLabel', () => {
  it('returns filename for file source', () => {
    const label = getSourceLabel({
      kind: 'file',
      uri: vscode.Uri.file('/foo/bar.ts'),
      content: '',
      label: 'bar.ts'
    });
    assert.strictEqual(label, 'bar.ts');
  });

  it('returns Clipboard for clipboard source', () => {
    const label = getSourceLabel({ kind: 'clipboard', content: 'x', label: 'Clipboard' });
    assert.strictEqual(label, 'Clipboard');
  });

  it('returns Empty for empty source', () => {
    const label = getSourceLabel({ kind: 'empty', content: '', label: 'Empty' });
    assert.strictEqual(label, 'Empty');
  });
});

describe('getLanguageForFile', () => {
  it('infers language from file extension', () => {
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.ts')), 'typescript');
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.md')), 'markdown');
  });

  it('returns undefined for unknown extensions', () => {
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.xyz')), undefined);
  });
});

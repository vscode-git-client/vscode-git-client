import * as assert from 'assert';
import { describe, it } from 'node:test';
import { formatTextCompareTitle } from '../editor/textCompareSession';

describe('formatTextCompareTitle', () => {
  it('combines two labels with the compare glyph', () => {
    assert.strictEqual(formatTextCompareTitle('foo.txt', 'bar.txt'), 'foo.txt ↔ bar.txt · Text Compare');
  });

  it('escapes undefined labels to empty strings', () => {
    assert.strictEqual(formatTextCompareTitle('', 'Clipboard'), ' ↔ Clipboard · Text Compare');
  });
});

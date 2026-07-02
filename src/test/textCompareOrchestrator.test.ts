import * as assert from 'assert';
import { describe, it } from 'node:test';
import { buildPickOrder } from '../editor/textCompareOrchestrator';

describe('buildPickOrder', () => {
  it('picks both sides when no seed is provided', () => {
    const order = buildPickOrder(undefined);
    assert.deepStrictEqual(order, ['left', 'right']);
  });

  it('skips left when left is seeded', () => {
    const order = buildPickOrder('left');
    assert.deepStrictEqual(order, ['right']);
  });

  it('skips right when right is seeded', () => {
    const order = buildPickOrder('right');
    assert.deepStrictEqual(order, ['left']);
  });
});

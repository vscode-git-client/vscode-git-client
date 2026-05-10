import * as assert from 'assert';
import { describe, it } from 'node:test';
import { RefreshScheduler, RefreshScope } from '../state/refreshScheduler';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('RefreshScheduler', () => {
  it('coalesces scopes requested in the same turn', async () => {
    const batches: RefreshScope[][] = [];
    const scheduler = new RefreshScheduler(async (scopes) => {
      batches.push([...scopes].sort());
    });

    await Promise.all([
      scheduler.request(['changes']),
      scheduler.request(['refs'])
    ]);

    assert.deepStrictEqual(batches, [['changes', 'refs']]);
  });

  it('never runs overlapping refreshes and drains queued scopes afterward', async () => {
    const batches: RefreshScope[][] = [];
    let active = 0;
    let maxActive = 0;
    let requestedDuringRun = false;

    const scheduler = new RefreshScheduler(async (scopes) => {
      batches.push([...scopes].sort());
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (!requestedDuringRun) {
        requestedDuringRun = true;
        void scheduler.request(['graph']);
      }
      await delay(10);
      active -= 1;
    });

    await scheduler.request(['changes']);
    await delay(30);

    assert.strictEqual(maxActive, 1);
    assert.deepStrictEqual(batches, [['changes'], ['graph']]);
  });
});

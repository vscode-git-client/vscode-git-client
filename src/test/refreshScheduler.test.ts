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

    await Promise.all([scheduler.request(['changes']), scheduler.request(['refs'])]);

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

  it('coalesces delayed requests into a single batch', async () => {
    const batches: RefreshScope[][] = [];
    const scheduler = new RefreshScheduler(async (scopes) => {
      batches.push([...scopes].sort());
    });

    void scheduler.request(['changes'], { delayMs: 20 });
    void scheduler.request(['refs'], { delayMs: 20 });

    await delay(60);

    assert.deepStrictEqual(batches, [['changes', 'refs']]);
  });

  it('coalesces multiple requests arriving during in-flight refresh into a single follow-up batch', async () => {
    const batches: RefreshScope[][] = [];
    let active = 0;
    let maxActive = 0;
    let firedExtraRequests = false;

    const scheduler = new RefreshScheduler(async (scopes) => {
      batches.push([...scopes].sort());
      active += 1;
      maxActive = Math.max(maxActive, active);

      if (!firedExtraRequests) {
        firedExtraRequests = true;
        // Fire three interleaved requests while the first refresh is still running.
        void scheduler.request(['refs']);
        void scheduler.request(['changes']);
        void scheduler.request(['stashes']);
      }

      await delay(15);
      active -= 1;
    });

    await scheduler.request(['changes']);
    await delay(60);

    assert.strictEqual(maxActive, 1, 'never overlap');
    assert.strictEqual(batches.length, 2, 'one in-flight batch, one coalesced follow-up');
    assert.deepStrictEqual(batches[0], ['changes']);
    assert.deepStrictEqual(batches[1], ['changes', 'refs', 'stashes']);
  });
});

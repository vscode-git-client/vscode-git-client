import * as assert from 'assert';
import * as path from 'path';
import { describe, it } from 'node:test';
import { GitCommandQueue } from '../services/gitCommandQueue';
import { resolveSubmoduleCwd } from '../services/submoduleService';
import { isGeneratedPath, shouldSkipGutterDocument } from '../editor/gutterGuards';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('GitCommandQueue', () => {
  it('caps concurrent command execution', async () => {
    const queue = new GitCommandQueue(2);
    let active = 0;
    let maxActive = 0;

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        queue.run(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await delay(5);
          active -= 1;
          return index;
        })
      )
    );

    assert.strictEqual(maxActive, 2);
  });
});

describe('Windows path and gutter guards', () => {
  it('resolves relative submodule cwd with path.join and preserves absolute cwd', () => {
    const root = path.resolve('/tmp/repo');
    const absoluteSubmodule = path.join(root, 'abs-sub');
    assert.strictEqual(resolveSubmoduleCwd(root, 'libs/sub'), path.join(root, 'libs/sub'));
    assert.strictEqual(resolveSubmoduleCwd(root, absoluteSubmodule), absoluteSubmodule);
  });

  it('skips large, long, and generated gutter marker inputs', () => {
    assert.strictEqual(shouldSkipGutterDocument(100, 64 * 1024, 10000, 512), false);
    assert.strictEqual(shouldSkipGutterDocument(10001, 64 * 1024, 10000, 512), true);
    assert.strictEqual(shouldSkipGutterDocument(100, 513 * 1024, 10000, 512), true);
    assert.strictEqual(isGeneratedPath('node_modules/pkg/index.js'), true);
    assert.strictEqual(isGeneratedPath('src/index.ts'), false);
  });
});

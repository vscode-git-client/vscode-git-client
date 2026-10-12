import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { handleScmStashResource } from '../commands/commandController/handleScmStashResource';
import { handleStashCreate } from '../commands/commandController/handleStashCreate';

interface WindowMocks {
  showInputBox: unknown[];
  showQuickPick: unknown[];
  informationMessages: string[];
}

function patchWindow(mocks: WindowMocks): () => void {
  const win = vscode.window as unknown as Record<string, unknown>;
  const original = {
    showInputBox: win.showInputBox,
    showQuickPick: win.showQuickPick,
    showInformationMessage: win.showInformationMessage,
    showWarningMessage: win.showWarningMessage
  };

  let inputIndex = 0;
  win.showInputBox = async () => mocks.showInputBox[inputIndex++] as never;

  let quickPickIndex = 0;
  win.showQuickPick = async () => mocks.showQuickPick[quickPickIndex++] as never;

  win.showInformationMessage = async (message: string) => {
    mocks.informationMessages.push(message);
    return undefined;
  };

  win.showWarningMessage = async () => undefined;

  return () => {
    for (const [key, value] of Object.entries(original)) {
      win[key] = value;
    }
  };
}

const callHandleStashCreate = handleStashCreate as unknown as (this: never) => Promise<void>;
const callHandleScmStashResource = handleScmStashResource as unknown as (
  this: never,
  arg?: unknown
) => Promise<void>;

describe('stash actions defaults', () => {
  it('handleStashCreate always enables includeUntracked', async () => {
    const calls: Array<{
      message: string;
      options: { includeUntracked: boolean; keepIndex: boolean };
    }> = [];

    const restore = patchWindow({
      showInputBox: ['  save work  '],
      showQuickPick: ['No'],
      informationMessages: []
    });

    try {
      await callHandleStashCreate.call({
        git: {
          createStash: async (
            message: string,
            options: { includeUntracked: boolean; keepIndex: boolean }
          ) => {
            calls.push({ message, options });
          }
        },
        state: { refreshAll: async () => {} }
      } as never);
    } finally {
      restore();
    }

    assert.deepStrictEqual(calls, [
      {
        message: 'save work',
        options: { includeUntracked: true, keepIndex: false }
      }
    ]);
  });

  it('handleScmStashResource stashes selected file with includeUntracked enabled', async () => {
    let captured:
      | {
          paths: string[];
          message: string;
          options: { keepIndex: boolean; includeUntracked?: boolean };
        }
      | undefined;

    const infoMessages: string[] = [];
    const restore = patchWindow({
      showInputBox: [''],
      showQuickPick: [],
      informationMessages: infoMessages
    });

    try {
      await callHandleScmStashResource.call(
        {
          toRepoFilePath: () => 'src/new-untracked.ts',
          git: {
            stashFiles: async (
              paths: string[],
              message: string,
              options: { keepIndex: boolean; includeUntracked?: boolean }
            ) => {
              captured = { paths, message, options };
            }
          },
          state: { refreshAll: async () => {} }
        } as never,
        {}
      );
    } finally {
      restore();
    }

    assert.deepStrictEqual(captured, {
      paths: ['src/new-untracked.ts'],
      message: 'Stash src/new-untracked.ts',
      options: { keepIndex: true, includeUntracked: true }
    });
    assert.deepStrictEqual(infoMessages, ['Stashed src/new-untracked.ts.']);
  });
});

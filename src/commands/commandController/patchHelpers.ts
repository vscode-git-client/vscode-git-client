import * as vscode from 'vscode';

export async function pickPatchOutputTarget(title: string): Promise<'clipboard' | 'file' | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: 'Save to patch file',
        description: 'Write patch text to a .patch/.diff file',
        target: 'file' as const
      },
      {
        label: 'Copy patch to clipboard',
        description: 'Copy patch text so you can paste it anywhere',
        target: 'clipboard' as const
      }
    ],
    {
      title
    }
  );
  return picked?.target;
}

export async function pickPatchSource(): Promise<{ kind: 'clipboard' | 'file' } | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: 'Apply patch from clipboard',
        description: 'Use patch text currently in clipboard',
        source: 'clipboard' as const
      },
      {
        label: 'Apply patch from file',
        description: 'Pick a .patch/.diff file from disk',
        source: 'file' as const
      }
    ],
    {
      title: 'Apply Patch'
    }
  );
  return picked ? { kind: picked.source } : undefined;
}

export async function readPatchFromFile(): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({
    title: 'Select Patch File',
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      Patch: ['patch', 'diff'],
      Text: ['txt']
    }
  });
  const uri = picked?.[0];
  if (!uri) {
    return undefined;
  }

  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf8');
}

import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export async function pickBranchName(
  this: CommandControllerShape,
  title = 'Pick branch',
  remoteOnly = false
): Promise<string | undefined> {
  type BranchPickItem = vscode.QuickPickItem & { value: string };
  const qp = vscode.window.createQuickPick<BranchPickItem>();
  qp.title = title;
  qp.placeholder = 'Pick branch';
  qp.busy = false;

  const toItems = (): BranchPickItem[] =>
    this.state.branches
      .filter((branch) => (remoteOnly ? branch.type === 'remote' : true))
      .map((branch) => ({
        label: branch.name,
        description: branch.current ? 'current' : branch.type,
        detail: `${branch.upstream ? `upstream ${branch.upstream}` : 'no upstream'} · ▲${branch.ahead} ▼${branch.behind}`,
        value: branch.name
      }));

  const setItems = (): void => {
    const items = toItems();
    qp.items = items;
    qp.placeholder = items.length > 0 ? 'Pick branch' : 'No branches found';
  };

  setItems();

  const selectionPromise = new Promise<string | undefined>((resolve) => {
    const disposables: vscode.Disposable[] = [];
    const finish = (value: string | undefined) => {
      while (disposables.length > 0) {
        disposables.pop()?.dispose();
      }
      qp.dispose();
      resolve(value);
    };

    disposables.push(
      qp.onDidAccept(() => finish(qp.selectedItems[0]?.value)),
      qp.onDidHide(() => finish(undefined))
    );
  });

  qp.show();

  if (qp.items.length === 0) {
    qp.busy = true;
    qp.placeholder = 'Loading branches...';
    void this.state
      .refreshBranches()
      .then(() => {
        setItems();
      })
      .catch(() => {
        qp.placeholder = 'Failed to load branches';
      })
      .finally(() => {
        qp.busy = false;
      });
  }

  return selectionPromise;
}

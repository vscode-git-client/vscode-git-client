import * as vscode from 'vscode';
import { GitCommand } from '../config/commands';
import { VisualGraphData } from '../services/gitService/getVisualGraphData';
import { handleCommitAction } from './commitActions';
import { renderTemplate } from './templateRenderer';

export class GraphVisualView {
  private static current: GraphVisualView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private initialData: VisualGraphData,
    private onRefresh?: () => Promise<VisualGraphData>
  ) {
    this.panel = vscode.window.createWebviewPanel(
      GitCommand.GraphVisualView,
      'Git Graph (Visual)',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    this.panel.webview.html = this.getWebviewContent(initialData);

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case 'ready':
            // Webview loaded, send initial data
            await this.panel.webview.postMessage({
              type: 'setData',
              data: this.initialData
            });
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'action':
          case 'commitAction':
            const shouldRefresh = await handleCommitAction({
              type: 'commitAction',
              action:
                message.action === 'copyHash'
                  ? 'copyCommitId'
                  : message.action === 'checkout'
                    ? 'checkoutRevision'
                    : message.action === 'createBranch'
                      ? 'newBranch'
                      : message.action === 'createTag'
                        ? 'newTag'
                        : message.action === 'revert'
                          ? 'revertCommit'
                          : message.action,
              sha: message.sha,
              subject: message.subject
            });
            if (shouldRefresh) {
              await this.refresh();
            }
            break;
        }
      })
    );
  }

  public async refresh(): Promise<void> {
    if (this.onRefresh) {
      try {
        const newData = await this.onRefresh();
        this.initialData = newData;
        await this.panel.webview.postMessage({
          type: 'setData',
          data: newData
        });
      } catch (error) {
        void vscode.window.showErrorMessage(
          `VS Code Git Client: Failed to refresh visual graph - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  public static show(
    extensionUri: vscode.Uri,
    data: VisualGraphData,
    onRefresh?: () => Promise<VisualGraphData>
  ): void {
    if (GraphVisualView.current) {
      GraphVisualView.current.onRefresh = onRefresh;
      GraphVisualView.current.initialData = data;
      GraphVisualView.current.panel.reveal(vscode.ViewColumn.Active);
      GraphVisualView.current.panel.webview.postMessage({
        type: 'setData',
        data
      });
      return;
    }

    const panel = new GraphVisualView(extensionUri, data, onRefresh);
    GraphVisualView.current = panel;
  }

  public dispose(): void {
    GraphVisualView.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getWebviewContent(data: VisualGraphData): string {
    const nonce = getNonce();

    return renderTemplate('graphVisualView.hbs', {
      cspSource: this.panel.webview.cspSource,
      nonce,
      initialDataJson: JSON.stringify(data)
    });
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

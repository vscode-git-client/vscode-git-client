import * as vscode from 'vscode';

export class Logger {
  private readonly channel = vscode.window.createOutputChannel('VS Code Git Client');

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  error(message: string, error?: unknown): void {
    this.channel.appendLine(`[error] ${message}`);
    if (error instanceof Error) {
      this.channel.appendLine(error.stack ?? error.message);
    } else if (error !== undefined) {
      this.channel.appendLine(String(error));
    }
  }

  show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }

  dispose(): void {
    this.channel.dispose();
  }
}

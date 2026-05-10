import * as vscode from 'vscode';
import XLSX from 'xlsx';
import { renderTemplate } from './templateRenderer';
import { handleCommitAction, isCommitActionMessage } from './commitActions';
import { formatCommitDate } from './commitDate';
import { CompareResult, GraphCommit } from '../types';

interface CommitClickMessage {
  readonly type: 'commitClick';
  readonly sha: string;
  readonly subject: string;
}

interface CompareExportCommit {
  readonly sha: string;
  readonly subject: string;
  readonly author: string;
  readonly date: string;
}

interface ExportExcelMessage {
  readonly type: 'exportExcel';
  readonly leftRef: string;
  readonly rightRef: string;
  readonly leftCommits: CompareExportCommit[];
  readonly rightCommits: CompareExportCommit[];
}

export class CompareView {
  private readonly panel: vscode.WebviewPanel;
  private disposeCallback: (() => void) | undefined;
  private currentResult: CompareResult | undefined;

  constructor(private readonly onCommitClick: (sha: string, subject: string) => Promise<void>) {
    this.panel = vscode.window.createWebviewPanel(
      'intelliGit.branchCompare',
      'IntelliGit: Branch Comparison',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.onDidReceiveMessage(async (message: unknown) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        void vscode.window.showErrorMessage(`IntelliGit: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    this.panel.onDidDispose(() => {
      this.disposeCallback?.();
    });
  }

  onDispose(callback: () => void): void {
    this.disposeCallback = callback;
  }

  reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Active, false);
  }

  dispose(): void {
    this.panel.dispose();
  }

  render(result: CompareResult): void {
    this.currentResult = result;
    this.panel.title = `Compare ${result.leftRef} <> ${result.rightRef}`;
    this.panel.webview.html = renderCompareHtml(result);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (isCommitClickMessage(message)) {
      await this.onCommitClick(message.sha, message.subject);
      return;
    }

    if (isExportExcelMessage(message)) {
      await this.exportToExcel(message);
      return;
    }

    if (!isCommitActionMessage(message)) {
      return;
    }

    await handleCommitAction(message);
  }

  private async exportToExcel(message: ExportExcelMessage): Promise<void> {
    const leftRef = message.leftRef || this.currentResult?.leftRef || 'left';
    const rightRef = message.rightRef || this.currentResult?.rightRef || 'right';
    const defaultFileName = `${sanitizeFileNameSegment(leftRef)}-vs-${sanitizeFileNameSegment(rightRef)}.xlsx`;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceRoot ? vscode.Uri.joinPath(workspaceRoot, defaultFileName) : undefined;
    const targetUri = await vscode.window.showSaveDialog({
      title: 'Export Compare Branches As Excel',
      saveLabel: 'Export',
      defaultUri,
      filters: {
        'Excel Workbook': ['xlsx']
      }
    });

    if (!targetUri) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    const [leftSheetName, rightSheetName] = buildSheetNames(leftRef, rightRef);
    const leftSheet = XLSX.utils.json_to_sheet(
      message.leftCommits.map((commit) => ({
        SHA: commit.sha,
        Subject: commit.subject,
        Author: commit.author,
        Date: commit.date
      }))
    );
    const rightSheet = XLSX.utils.json_to_sheet(
      message.rightCommits.map((commit) => ({
        SHA: commit.sha,
        Subject: commit.subject,
        Author: commit.author,
        Date: commit.date
      }))
    );

    XLSX.utils.book_append_sheet(workbook, leftSheet, leftSheetName);
    XLSX.utils.book_append_sheet(workbook, rightSheet, rightSheetName);
    const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const bytes = workbookBuffer instanceof Uint8Array ? workbookBuffer : Buffer.from(workbookBuffer);
    await vscode.workspace.fs.writeFile(targetUri, bytes);
    void vscode.window.showInformationMessage(`IntelliGit: Exported compare commits to ${targetUri.fsPath}`);
  }

}

function renderCompareHtml(result: CompareResult): string {
  return renderTemplate('compareView.hbs', {
    leftRef: result.leftRef,
    leftTotal: result.commitsOnlyLeft.length,
    leftCommits: renderCommitRows(result.commitsOnlyLeft, 'left'),
    rightRef: result.rightRef,
    rightTotal: result.commitsOnlyRight.length,
    rightCommits: renderCommitRows(result.commitsOnlyRight, 'right'),
    authorsJson: toInlineJson(collectDistinctAuthors(result.commitsOnlyLeft, result.commitsOnlyRight))
  });
}

function renderCommitRows(commits: GraphCommit[], side: 'left' | 'right'): string {
  if (commits.length === 0) {
    return '<tr><td colspan="4">No commits</td></tr>';
  }

  return commits
    .map((commit) => {
      const date = formatCommitDate(commit.date);
      const rel = escapeHtml(date.label);
      const full = escapeHtml(date.title);
      const graph = escapeHtml(renderGraphGlyph(commit.graph));
      return `<tr class="commit-row" data-sha="${escapeHtml(commit.sha)}" data-subject="${escapeHtml(commit.subject)}" data-author="${escapeHtml(commit.author)}" data-timestamp="${date.timestamp}" data-side="${side}" title="${escapeHtml(commit.sha)}"><td class="col-graph copyable" title="Copy commit id: ${escapeHtml(commit.sha)}">${graph}</td><td class="col-subject">${escapeHtml(commit.subject)}</td><td class="col-author">${escapeHtml(commit.author)}</td><td class="col-date muted"><span title="${full}">${rel}</span></td></tr>`;
    })
    .join('');
}

function collectDistinctAuthors(left: GraphCommit[], right: GraphCommit[]): string[] {
  const unique = new Map<string, string>();
  for (const commit of [...left, ...right]) {
    const raw = commit.author.trim();
    if (!raw) {
      continue;
    }
    const normalized = raw.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, raw);
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

function renderGraphGlyph(graph?: string): string {
  if (graph === '<') return '◀';
  if (graph === '>') return '▶';
  if (graph === '-') return '●';
  return '○';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isCommitClickMessage(value: unknown): value is CommitClickMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const c = value as Record<string, unknown>;
  return c.type === 'commitClick' && typeof c.sha === 'string';
}

function isExportExcelMessage(value: unknown): value is ExportExcelMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type !== 'exportExcel') {
    return false;
  }

  return (
    typeof candidate.leftRef === 'string' &&
    typeof candidate.rightRef === 'string' &&
    Array.isArray(candidate.leftCommits) &&
    Array.isArray(candidate.rightCommits)
  );
}

function buildSheetNames(leftRef: string, rightRef: string): [string, string] {
  const left = sanitizeSheetName(leftRef, 'left');
  const right = sanitizeSheetName(rightRef, 'right');
  if (left !== right) {
    return [left, right];
  }

  const leftSuffix = ' (1)';
  const rightSuffix = ' (2)';
  const maxLength = 31;
  const sharedPrefixLength = Math.max(0, maxLength - leftSuffix.length);
  const prefix = left.slice(0, sharedPrefixLength);
  return [`${prefix}${leftSuffix}`, `${prefix}${rightSuffix}`];
}

function sanitizeSheetName(ref: string, fallback: string): string {
  const cleaned = ref
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned || fallback;
  return safe.slice(0, 31);
}

function sanitizeFileNameSegment(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'branch';
}

import * as vscode from 'vscode';
import { affectsConfig, getConfigValue } from '../configuration';
import { Logger } from '../logger';
import { GitService } from '../services/gitService';
import { StateStore } from '../state/stateStore';
import {
  DEFAULT_GUTTER_MAX_FILE_SIZE_KB,
  DEFAULT_GUTTER_MAX_LINE_COUNT,
  isGeneratedPath,
  shouldSkipGutterDocument
} from './gutterGuards';
import { computeLineHunks, LineHunk } from './lineDiff';

const UPDATE_DEBOUNCE_MS = 250;

type DecorationSet = {
  added: vscode.TextEditorDecorationType;
  modified: vscode.TextEditorDecorationType;
  removed: vscode.TextEditorDecorationType;
};

type HeadCacheEntry = {
  headSha: string;
  relativePath: string;
  content: string | null; // null means file did not exist in HEAD
};

export class GutterDecorationController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly decorations: DecorationSet;
  private readonly updateTimers = new WeakMap<vscode.TextEditor, ReturnType<typeof setTimeout>>();
  private readonly updateVersions = new WeakMap<vscode.TextEditor, number>();
  private readonly headCache = new Map<string, HeadCacheEntry>();
  private currentHeadSha = '';
  private enabled: boolean;
  private maxLineCount: number;
  private maxFileSizeKb: number;

  constructor(
    private readonly gitService: GitService,
    private readonly stateStore: StateStore,
    private readonly logger: Logger
  ) {
    this.enabled = getConfigValue<boolean>('gutterMarkers.enabled', true);
    this.maxLineCount = getConfigValue<number>(
      'gutterMarkers.maxLineCount',
      DEFAULT_GUTTER_MAX_LINE_COUNT
    );
    this.maxFileSizeKb = getConfigValue<number>(
      'gutterMarkers.maxFileSizeKb',
      DEFAULT_GUTTER_MAX_FILE_SIZE_KB
    );
    this.decorations = createDecorations();

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.scheduleUpdate(editor, 0);
        }
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) {
            this.scheduleUpdate(editor, UPDATE_DEBOUNCE_MS);
          }
        }
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => {
        const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc);
        if (editor) {
          this.scheduleUpdate(editor, 0);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.headCache.delete(doc.uri.toString());
      }),
      this.stateStore.onDidChange(() => {
        void this.refreshHeadSha().then((changed) => {
          if (changed) {
            this.updateAllVisible();
          }
        });
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (affectsConfig(event, 'gutterMarkers')) {
          this.enabled = getConfigValue<boolean>('gutterMarkers.enabled', true);
          this.maxLineCount = getConfigValue<number>(
            'gutterMarkers.maxLineCount',
            DEFAULT_GUTTER_MAX_LINE_COUNT
          );
          this.maxFileSizeKb = getConfigValue<number>(
            'gutterMarkers.maxFileSizeKb',
            DEFAULT_GUTTER_MAX_FILE_SIZE_KB
          );
          if (!this.enabled) {
            this.clearAllVisible();
          } else {
            this.updateAllVisible();
          }
        }
      })
    );

    void this.refreshHeadSha().then(() => this.updateAllVisible());
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.decorations.added.dispose();
    this.decorations.modified.dispose();
    this.decorations.removed.dispose();
  }

  private scheduleUpdate(editor: vscode.TextEditor, delay: number): void {
    const existing = this.updateTimers.get(editor);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.updateTimers.delete(editor);
      void this.update(editor);
    }, delay);
    this.updateTimers.set(editor, timer);
  }

  private updateAllVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.scheduleUpdate(editor, 0);
    }
  }

  private clearAllVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decorations.added, []);
      editor.setDecorations(this.decorations.modified, []);
      editor.setDecorations(this.decorations.removed, []);
    }
  }

  private async refreshHeadSha(): Promise<boolean> {
    try {
      const sha = await this.gitService.getCurrentHeadSha();
      if (sha !== this.currentHeadSha) {
        this.currentHeadSha = sha;
        this.headCache.clear();
        return true;
      }
    } catch {
      const changed = this.currentHeadSha !== '';
      this.currentHeadSha = '';
      this.headCache.clear();
      return changed;
    }
    return false;
  }

  private async update(editor: vscode.TextEditor): Promise<void> {
    const updateVersion = (this.updateVersions.get(editor) ?? 0) + 1;
    this.updateVersions.set(editor, updateVersion);

    if (!this.enabled) {
      return;
    }
    const doc = editor.document;
    if (doc.uri.scheme !== 'file') {
      return;
    }
    const relativePath = this.getRelativePath(doc.uri);
    if (!relativePath) {
      return;
    }

    try {
      if (await this.shouldSkipDocument(doc, relativePath)) {
        this.applyHunks(editor, []);
        return;
      }

      const headContent = await this.getHeadContent(doc.uri, relativePath);
      if (this.updateVersions.get(editor) !== updateVersion) {
        return;
      }
      if (headContent === null) {
        this.applyHunks(editor, [
          { kind: 'add', newStart: 0, newCount: doc.lineCount, oldCount: 0 }
        ]);
        return;
      }
      const hunks = computeLineHunks(headContent, doc.getText());
      this.applyHunks(editor, hunks);
    } catch (error) {
      this.logger.warn(`Gutter update failed for ${relativePath}: ${String(error)}`);
      this.applyHunks(editor, []);
    }
  }

  private async getHeadContent(uri: vscode.Uri, relativePath: string): Promise<string | null> {
    const key = uri.toString();
    const cached = this.headCache.get(key);
    if (cached && cached.headSha === this.currentHeadSha && cached.relativePath === relativePath) {
      return cached.content;
    }
    let content: string | null;
    try {
      content = await this.gitService.getFileContentFromRef('HEAD', relativePath);
    } catch {
      content = null;
    }
    this.headCache.set(key, { headSha: this.currentHeadSha, relativePath, content });
    return content;
  }

  private getRelativePath(uri: vscode.Uri): string | undefined {
    return this.gitService.toRepoRelative(uri.fsPath);
  }

  private async shouldSkipDocument(
    doc: vscode.TextDocument,
    relativePath: string
  ): Promise<boolean> {
    if (isGeneratedPath(relativePath)) {
      return true;
    }

    try {
      const stat = await vscode.workspace.fs.stat(doc.uri);
      return shouldSkipGutterDocument(
        doc.lineCount,
        stat.size,
        this.maxLineCount,
        this.maxFileSizeKb
      );
    } catch {
      return shouldSkipGutterDocument(doc.lineCount, 0, this.maxLineCount, this.maxFileSizeKb);
    }
  }

  private applyHunks(editor: vscode.TextEditor, hunks: LineHunk[]): void {
    const added: vscode.Range[] = [];
    const modified: vscode.Range[] = [];
    const removed: vscode.Range[] = [];
    const lineCount = editor.document.lineCount;

    for (const hunk of hunks) {
      if (hunk.kind === 'remove') {
        const markerLine = Math.min(Math.max(hunk.newStart - 1, 0), Math.max(lineCount - 1, 0));
        if (lineCount > 0) {
          removed.push(new vscode.Range(markerLine, 0, markerLine, 0));
        }
        continue;
      }
      const start = hunk.newStart;
      const end = Math.min(hunk.newStart + hunk.newCount, lineCount);
      if (end <= start) {
        continue;
      }
      const range = new vscode.Range(start, 0, end - 1, 0);
      if (hunk.kind === 'add') {
        added.push(range);
      } else {
        modified.push(range);
      }
    }

    editor.setDecorations(this.decorations.added, added);
    editor.setDecorations(this.decorations.modified, modified);
    editor.setDecorations(this.decorations.removed, removed);
  }
}

function createDecorations(): DecorationSet {
  const added = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    overviewRulerColor: new vscode.ThemeColor('editorGutter.addedBackground'),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    dark: {
      gutterIconPath: gutterBar('#587c0c')
    },
    light: {
      gutterIconPath: gutterBar('#587c0c')
    }
  });
  const modified = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    overviewRulerColor: new vscode.ThemeColor('editorGutter.modifiedBackground'),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    dark: {
      gutterIconPath: gutterBar('#0c7d9d')
    },
    light: {
      gutterIconPath: gutterBar('#0c7d9d')
    }
  });
  const removed = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    overviewRulerColor: new vscode.ThemeColor('editorGutter.deletedBackground'),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    dark: {
      gutterIconPath: gutterTriangle('#94151b')
    },
    light: {
      gutterIconPath: gutterTriangle('#94151b')
    }
  });
  return { added, modified, removed };
}

function gutterBar(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="24" viewBox="0 0 8 24"><rect x="2" y="0" width="3" height="24" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

function gutterTriangle(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="24" viewBox="0 0 8 24"><polygon points="2,20 8,24 2,24" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

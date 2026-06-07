import * as vscode from 'vscode';
import { affectsConfig, getConfigValue } from '../../configuration';
import { Logger } from '../../logger';
import { GitService } from '../../services/gitService';
import { StateStore } from '../../state/stateStore';
import {
  DEFAULT_GUTTER_MAX_FILE_SIZE_KB,
  DEFAULT_GUTTER_MAX_LINE_COUNT
} from '../gutterGuards';
import type { LineHunk } from '../lineDiff';
import type { DecorationSet, HeadCacheEntry } from './types';
import { createDecorations } from './createDecorations';
import { dispose } from './dispose';
import { scheduleUpdate } from './scheduleUpdate';
import { updateAllVisible } from './updateAllVisible';
import { clearAllVisible } from './clearAllVisible';
import { refreshHeadSha } from './refreshHeadSha';
import { update } from './update';
import { getHeadContent } from './getHeadContent';
import { getRelativePath } from './getRelativePath';
import { shouldSkipDocument } from './shouldSkipDocument';
import { applyHunks } from './applyHunks';

const UPDATE_DEBOUNCE_MS = 250;

/**
 * Structural interface used by extracted method files to type their `this` parameter.
 * All fields and methods remain private on the class; the `as unknown as` cast in each
 * delegating wrapper bridges TypeScript's compile-time private check.
 */
export interface GutterDecorationControllerShape {
  readonly disposables: vscode.Disposable[];
  readonly decorations: DecorationSet;
  readonly updateTimers: WeakMap<vscode.TextEditor, ReturnType<typeof setTimeout>>;
  readonly updateVersions: WeakMap<vscode.TextEditor, number>;
  readonly headCache: Map<string, HeadCacheEntry>;
  currentHeadSha: string;
  enabled: boolean;
  maxLineCount: number;
  maxFileSizeKb: number;
  readonly gitService: GitService;
  readonly stateStore: StateStore;
  readonly logger: Logger;
  scheduleUpdate(editor: vscode.TextEditor, delay: number): void;
  updateAllVisible(): void;
  clearAllVisible(): void;
  refreshHeadSha(): Promise<boolean>;
  update(editor: vscode.TextEditor): Promise<void>;
  getHeadContent(uri: vscode.Uri, relativePath: string): Promise<string | null>;
  getRelativePath(uri: vscode.Uri): string | undefined;
  shouldSkipDocument(doc: vscode.TextDocument, relativePath: string): Promise<boolean>;
  applyHunks(editor: vscode.TextEditor, hunks: LineHunk[]): void;
  dispose(): void;
}

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
    this.maxLineCount = getConfigValue<number>('gutterMarkers.maxLineCount', DEFAULT_GUTTER_MAX_LINE_COUNT);
    this.maxFileSizeKb = getConfigValue<number>('gutterMarkers.maxFileSizeKb', DEFAULT_GUTTER_MAX_FILE_SIZE_KB);
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
          this.maxLineCount = getConfigValue<number>('gutterMarkers.maxLineCount', DEFAULT_GUTTER_MAX_LINE_COUNT);
          this.maxFileSizeKb = getConfigValue<number>('gutterMarkers.maxFileSizeKb', DEFAULT_GUTTER_MAX_FILE_SIZE_KB);
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
    dispose.call(this as unknown as GutterDecorationControllerShape);
  }

  private scheduleUpdate(editor: vscode.TextEditor, delay: number): void {
    scheduleUpdate.call(this as unknown as GutterDecorationControllerShape, editor, delay);
  }

  private updateAllVisible(): void {
    updateAllVisible.call(this as unknown as GutterDecorationControllerShape);
  }

  private clearAllVisible(): void {
    clearAllVisible.call(this as unknown as GutterDecorationControllerShape);
  }

  private async refreshHeadSha(): Promise<boolean> {
    return refreshHeadSha.call(this as unknown as GutterDecorationControllerShape);
  }

  private async update(editor: vscode.TextEditor): Promise<void> {
    return update.call(this as unknown as GutterDecorationControllerShape, editor);
  }

  private getHeadContent(uri: vscode.Uri, relativePath: string): Promise<string | null> {
    return getHeadContent.call(this as unknown as GutterDecorationControllerShape, uri, relativePath);
  }

  private getRelativePath(uri: vscode.Uri): string | undefined {
    return getRelativePath.call(this as unknown as GutterDecorationControllerShape, uri);
  }

  private async shouldSkipDocument(doc: vscode.TextDocument, relativePath: string): Promise<boolean> {
    return shouldSkipDocument.call(this as unknown as GutterDecorationControllerShape, doc, relativePath);
  }

  private applyHunks(editor: vscode.TextEditor, hunks: LineHunk[]): void {
    applyHunks.call(this as unknown as GutterDecorationControllerShape, editor, hunks);
  }
}

import * as vscode from 'vscode';
import type { DecorationSet } from './types';

function gutterBar(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="24" viewBox="0 0 8 24"><rect x="2" y="0" width="3" height="24" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

function gutterTriangle(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="24" viewBox="0 0 8 24"><polygon points="2,20 8,24 2,24" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

export function createDecorations(): DecorationSet {
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

import * as path from 'path';
import * as vscode from 'vscode';

export type TextSource =
  | { kind: 'file'; uri: vscode.Uri; content: string; label: string }
  | { kind: 'clipboard'; content: string; label: string }
  | { kind: 'empty'; content: string; label: string };

export function getSourceLabel(source: TextSource): string {
  return source.label;
}

export function getLanguageForFile(uri: vscode.Uri): string | undefined {
  const ext = path.extname(uri.fsPath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.json': 'json',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.py': 'python',
    '.sh': 'shellscript',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.xml': 'xml',
    '.sql': 'sql',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'cpp',
    '.cs': 'csharp'
  };
  return map[ext];
}

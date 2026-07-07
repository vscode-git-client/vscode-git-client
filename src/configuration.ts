import * as vscode from 'vscode';

export const CONFIG_SECTION = 'vscodeGitClient';
export const LEGACY_CONFIG_SECTION = 'intelliGit';

type ConfigurationInspect<T> = {
  readonly globalValue?: T;
  readonly workspaceValue?: T;
  readonly workspaceFolderValue?: T;
  readonly globalLanguageValue?: T;
  readonly workspaceLanguageValue?: T;
  readonly workspaceFolderLanguageValue?: T;
};

function hasExplicitValue<T>(inspect: ConfigurationInspect<T> | undefined): boolean {
  return (
    inspect?.globalValue !== undefined ||
    inspect?.workspaceValue !== undefined ||
    inspect?.workspaceFolderValue !== undefined ||
    inspect?.globalLanguageValue !== undefined ||
    inspect?.workspaceLanguageValue !== undefined ||
    inspect?.workspaceFolderLanguageValue !== undefined
  );
}

export function getConfigValue<T>(key: string, defaultValue: T): T {
  const current = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const legacy = vscode.workspace.getConfiguration(LEGACY_CONFIG_SECTION);

  if (typeof current.inspect !== 'function' || typeof legacy.inspect !== 'function') {
    return current.get<T>(key, legacy.get<T>(key, defaultValue));
  }

  if (hasExplicitValue(current.inspect<T>(key))) {
    return current.get<T>(key, defaultValue);
  }
  if (hasExplicitValue(legacy.inspect<T>(key))) {
    return legacy.get<T>(key, defaultValue);
  }
  return current.get<T>(key, defaultValue);
}

export function affectsConfig(event: vscode.ConfigurationChangeEvent, key: string): boolean {
  return (
    event.affectsConfiguration(`${CONFIG_SECTION}.${key}`) ||
    event.affectsConfiguration(`${LEGACY_CONFIG_SECTION}.${key}`)
  );
}

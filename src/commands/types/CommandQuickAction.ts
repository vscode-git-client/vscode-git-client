export interface CommandQuickAction {
  label: string;
  description?: string;
  run: () => Promise<void>;
}

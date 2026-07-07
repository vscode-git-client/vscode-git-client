export interface QuickAction {
  label: string;
  description?: string;
  run: () => Promise<void>;
}
export const DEFAULT_GUTTER_MAX_FILE_SIZE_KB = 512;
export const DEFAULT_GUTTER_MAX_LINE_COUNT = 10000;

export function shouldSkipGutterDocument(
  lineCount: number,
  fileSizeBytes: number,
  maxLineCount = DEFAULT_GUTTER_MAX_LINE_COUNT,
  maxFileSizeKb = DEFAULT_GUTTER_MAX_FILE_SIZE_KB
): boolean {
  return lineCount > maxLineCount || fileSizeBytes > maxFileSizeKb * 1024;
}

export function isGeneratedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return /(^|\/)(node_modules|dist|out|build|coverage|\.git)\//.test(normalized);
}

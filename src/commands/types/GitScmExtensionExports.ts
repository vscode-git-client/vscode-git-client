import type { GitScmApi } from "./GitScmApi";

export type GitScmExtensionExports = {
  getAPI(version: 1): GitScmApi;
};
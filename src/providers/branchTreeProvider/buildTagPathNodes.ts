import * as vscode from 'vscode';
import { TagRef } from '../../types';
import { TagPathNode, TagTreeItem, compareTagsByTimeDesc, latestTagEpoch } from './nodes';

export function buildTagPathNodes(tags: TagRef[], basePath: string, idPrefix: string): vscode.TreeItem[] {
  const groups = new Map<string, TagRef[]>();
  const leaves: TagTreeItem[] = [];

  for (const tag of tags) {
    const relativeName = basePath ? tag.name.slice(basePath.length + 1) : tag.name;
    if (!relativeName) {
      leaves.push(new TagTreeItem(tag, tag.name.split('/').at(-1) ?? tag.name, idPrefix));
      continue;
    }

    const parts = relativeName.split('/');
    if (parts.length === 1) {
      leaves.push(new TagTreeItem(tag, relativeName, idPrefix));
      continue;
    }

    const segment = parts[0];
    const childPath = basePath ? `${basePath}/${segment}` : segment;
    const list = groups.get(childPath) ?? [];
    list.push(tag);
    groups.set(childPath, list);
  }

  const groupItems = Array.from(groups.entries())
    .sort(([a, leftTags], [b, rightTags]) => {
      const leftLatest = latestTagEpoch(leftTags);
      const rightLatest = latestTagEpoch(rightTags);
      if (leftLatest !== rightLatest) {
        return rightLatest - leftLatest;
      }
      return a.localeCompare(b);
    })
    .map(([fullPath, tagSet]) => new TagPathNode(idPrefix, fullPath.split('/').at(-1) ?? fullPath, fullPath, tagSet));

  leaves.sort((a, b) => compareTagsByTimeDesc(a.tag, b.tag));

  return [...groupItems, ...leaves];
}

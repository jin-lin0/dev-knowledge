import type { CollectionEntry } from 'astro:content';

export type DocEntry = CollectionEntry<'docs'>;

export interface NavItem {
  href: string;
  id: string;
  title: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function getDocHref(id: string): string {
  if (id === 'index') return '/';
  const path = id.endsWith('/index') ? id.slice(0, -'/index'.length) : id;
  return `/${path}/`;
}

export function sortDocs(entries: DocEntry[]): DocEntry[] {
  return [...entries].sort((left, right) => {
    const leftIndex = isIndexEntry(left);
    const rightIndex = isIndexEntry(right);
    if (leftIndex !== rightIndex) return leftIndex ? -1 : 1;
    if (left.data.order !== right.data.order) return left.data.order - right.data.order;
    return left.data.title.localeCompare(right.data.title, 'zh-CN');
  });
}

function isIndexEntry(entry: DocEntry): boolean {
  return entry.id === 'index' || entry.id.endsWith('/index') || (entry.id.startsWith('knowledge/') && entry.id.split('/').length === 2);
}

export function buildNavigation(entries: DocEntry[]): NavGroup[] {
  const visible = sortDocs(entries.filter((entry) => !entry.data.draft));
  const primary = visible.filter((entry) => !entry.id.startsWith('knowledge/') && entry.id !== 'writing-guide');
  const maintenance = visible.filter((entry) => entry.id === 'writing-guide');
  const knowledge = visible.filter((entry) => entry.id.startsWith('knowledge/'));
  const groups: NavGroup[] = [];

  if (primary.length > 0) {
    groups.push({
      label: '开始',
      items: primary.map(toNavItem),
    });
  }

  const categories = new Map<string, DocEntry[]>();
  for (const entry of knowledge) {
    const category = entry.id.split('/')[1] ?? '其他';
    const items = categories.get(category) ?? [];
    items.push(entry);
    categories.set(category, items);
  }

  for (const [category, categoryEntries] of categories) {
    const sorted = sortDocs(categoryEntries);
    const indexEntry = sorted.find((entry) => entry.id === `knowledge/${category}` || entry.id.endsWith('/index'));
    groups.push({
      label: indexEntry?.data.title ?? category,
      items: sorted.map(toNavItem),
    });
  }

  if (maintenance.length > 0) {
    groups.push({
      label: '日常维护',
      items: maintenance.map(toNavItem),
    });
  }

  return groups;
}

export function flattenNavigation(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

function toNavItem(entry: DocEntry): NavItem {
  return {
    href: getDocHref(entry.id),
    id: entry.id,
    title: entry.data.navTitle ?? entry.data.title,
  };
}

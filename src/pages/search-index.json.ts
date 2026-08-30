import { getCollection } from 'astro:content';
import { getDocHref } from '../lib/docs';

export const prerender = true;

export async function GET() {
  const docs = await getCollection('docs', ({ data }) => !data.draft);
  const index = docs.map((entry) => ({
    title: entry.data.title,
    description: entry.data.description ?? '',
    href: getDocHref(entry.id),
    body: entry.body ?? '',
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

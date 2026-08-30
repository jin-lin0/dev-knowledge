import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/docs',
    retainBody: true,
  }),
  schema: z.object({
    title: z.string(),
    navTitle: z.string().optional(),
    description: z.string().optional(),
    kind: z.enum(['note', 'tutorial', 'how-to', 'reference', 'explanation']).optional(),
    audience: z.string().optional(),
    lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    order: z.number().default(999),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  docs,
};

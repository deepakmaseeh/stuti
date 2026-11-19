import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { BookSchema, SongSchema, songIdFromPath } from './lib/schema';

const books = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/books' }),
  schema: BookSchema,
});

const songs = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/songs',
    // ta/yesuve-en-thunai.json → ta-yesuve-en-thunai (id + language come from the path)
    generateId: ({ entry }) => songIdFromPath(entry),
  }),
  schema: SongSchema,
});

export const collections = { books, songs };

import { readdir, readFile, writeFile } from 'node:fs/promises';

const migrationsDirectory = new URL('../../prisma/migrations/', import.meta.url);
const outputPath = new URL('../../../schema.sql', import.meta.url);
const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const names = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const sections: string[] = [];

for (const name of names) {
  const sql = await readFile(
    new URL(`${name}/migration.sql`, migrationsDirectory),
    'utf8',
  );
  sections.push(`-- Migration: ${name}\n${sql.trim()}`);
}

const header = [
  '-- Field Report Management System',
  '-- Generated from the ordered Prisma migrations; do not edit independently.',
  '-- Apply to an EMPTY database instead of prisma migrate deploy, never after it.',
  '-- Contains structure and constraints only; demo data is seeded separately.',
  '-- Prisma migration bookkeeping is intentionally excluded.',
].join('\n');

await writeFile(
  outputPath,
  `${header}\n\nBEGIN;\n\n${sections.join('\n\n')}\n\nCOMMIT;\n`,
);
console.info(`Exported schema.sql from ${names.length} migrations.`);

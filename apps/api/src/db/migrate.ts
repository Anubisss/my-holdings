import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { logger } from '../lib/logger.js';
import { db, sqlite } from './client.js';

const currentDir = dirname(fileURLToPath(import.meta.url));

const migrationsFolder = resolve(currentDir, '../../drizzle');

export const runMigrations = (): void => {
  migrate(db, { migrationsFolder });
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runMigrations();
  sqlite.close();
  logger.info('Migrations applied.');
}

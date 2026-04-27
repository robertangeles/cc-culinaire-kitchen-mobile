import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const sqlite = openDatabaseSync('culinaire.db', { enableChangeListener: false });

export const db = drizzle(sqlite, { schema, logger: false });
export type DB = typeof db;

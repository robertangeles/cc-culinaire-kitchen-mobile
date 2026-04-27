import { desc, eq } from 'drizzle-orm';

import { db, type DB } from '../client';
import { conversations } from '../schema';
import type { ConversationInsert, ConversationRow } from '../schema';

export async function listByUser(userId: string, client: DB = db): Promise<ConversationRow[]> {
  return client
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedDttm));
}

export async function getById(id: string, client: DB = db): Promise<ConversationRow | undefined> {
  const rows = await client.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return rows[0];
}

export async function insert(value: ConversationInsert, client: DB = db): Promise<void> {
  await client.insert(conversations).values(value);
}

export async function touch(id: string, client: DB = db): Promise<void> {
  await client
    .update(conversations)
    .set({ updatedDttm: new Date(), isSynced: false })
    .where(eq(conversations.id, id));
}

export async function remove(id: string, client: DB = db): Promise<void> {
  await client.delete(conversations).where(eq(conversations.id, id));
}

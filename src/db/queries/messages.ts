import { asc, eq } from 'drizzle-orm';

import { db, type DB } from '../client';
import { messages } from '../schema';
import type { MessageInsert, MessageRow } from '../schema';

export async function listByConversation(
  conversationId: string,
  client: DB = db,
): Promise<MessageRow[]> {
  return client
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdDttm));
}

export async function insert(value: MessageInsert, client: DB = db): Promise<void> {
  await client.insert(messages).values(value);
}

export async function deleteByConversation(conversationId: string, client: DB = db): Promise<void> {
  await client.delete(messages).where(eq(messages.conversationId, conversationId));
}

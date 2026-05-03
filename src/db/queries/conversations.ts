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

/**
 * Delete every conversation for a user. The schema's onDelete: 'cascade'
 * on `ckm_message.conversation_id` cleans up message rows automatically.
 */
export async function removeAllForUser(userId: string, client: DB = db): Promise<void> {
  await client.delete(conversations).where(eq(conversations.userId, userId));
}

/**
 * Set the conversation's title. Used by the auto-title flow that derives
 * a title from the first user message in a new conversation, so the
 * History sheet stops showing a wall of identical "Untitled conversation"
 * rows.
 */
export async function setTitle(id: string, title: string, client: DB = db): Promise<void> {
  await client
    .update(conversations)
    .set({ title, updatedDttm: new Date(), isSynced: false })
    .where(eq(conversations.id, id));
}

/**
 * Set the per-conversation language override. Pass `null` to clear the
 * override and fall back to the user's global `i18nStore.language`.
 * Bumps `updatedDttm` and flips `isSynced` to false so the metadata
 * sync queue picks up the change on next online sync.
 */
export async function setLanguage(
  id: string,
  language: string | null,
  client: DB = db,
): Promise<void> {
  await client
    .update(conversations)
    .set({ language, updatedDttm: new Date(), isSynced: false })
    .where(eq(conversations.id, id));
}

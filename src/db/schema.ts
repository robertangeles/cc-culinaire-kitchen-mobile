/**
 * On-device SQLite schema for CulinAIre Mobile.
 *
 * Privacy: every table here lives ONLY on the device. Conversation content
 * (`ckm_message.content`) NEVER syncs to the backend. Per CLAUDE.md naming
 * rule, every table starts with `ckm_`. Every FK has an index.
 *
 * 2NF: each non-key column depends on the table's primary key only.
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable(
  'ckm_conversation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title'),
    createdDttm: integer('created_dttm', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedDttm: integer('updated_dttm', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
    syncedDttm: integer('synced_dttm', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    // serves: list-by-user query in conversationStore.hydrate.
    byUser: index('ckm_conversation_user_idx').on(t.userId, t.updatedDttm),
  }),
);

export const messages = sqliteTable(
  'ckm_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    imageUri: text('image_uri'),
    createdDttm: integer('created_dttm', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    // serves: list-by-conversation in messages.listByConversation.
    byConversation: index('ckm_message_conversation_idx').on(t.conversationId, t.createdDttm),
  }),
);

export type ConversationRow = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

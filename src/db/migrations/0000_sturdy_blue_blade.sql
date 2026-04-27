CREATE TABLE `ckm_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`created_dttm` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_dttm` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`synced_dttm` integer
);
--> statement-breakpoint
CREATE INDEX `ckm_conversation_user_idx` ON `ckm_conversation` (`user_id`,`updated_dttm`);--> statement-breakpoint
CREATE TABLE `ckm_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`image_uri` text,
	`created_dttm` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ckm_conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ckm_message_conversation_idx` ON `ckm_message` (`conversation_id`,`created_dttm`);
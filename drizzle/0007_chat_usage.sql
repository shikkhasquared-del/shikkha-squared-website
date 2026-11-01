CREATE TABLE `chat_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);

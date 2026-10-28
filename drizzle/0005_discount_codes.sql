CREATE TABLE `discount_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`percent` integer NOT NULL,
	`course_slug` text,
	`starts_at` text,
	`ends_at` text,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `list_price_minor` integer;
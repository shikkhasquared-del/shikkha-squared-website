CREATE TABLE `account_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`kind` text NOT NULL,
	`network` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`device` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_activity_student` ON `account_activity` (`student_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `account_activity_time` ON `account_activity` (`created_at`);
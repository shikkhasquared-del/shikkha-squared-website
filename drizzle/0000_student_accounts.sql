CREATE TABLE `login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`ip` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `login_codes_phone` ON `login_codes` (`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_codes_ip` ON `login_codes` (`ip`,`created_at`);--> statement-breakpoint
CREATE TABLE `student_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `student_sessions_student` ON `student_sessions` (`student_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text,
	`email` text,
	`google_sub` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_phone_unique` ON `students` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_google_sub_unique` ON `students` (`google_sub`);
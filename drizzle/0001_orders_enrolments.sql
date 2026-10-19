CREATE TABLE `enrolments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`course_slug` text NOT NULL,
	`course_title` text NOT NULL,
	`source` text NOT NULL,
	`order_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrolments_student_course` ON `enrolments` (`student_id`,`course_slug`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tran_id` text NOT NULL,
	`student_id` text NOT NULL,
	`course_slug` text NOT NULL,
	`course_title` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`status` text NOT NULL,
	`val_id` text,
	`bank_tran_id` text,
	`card_type` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tran_id_unique` ON `orders` (`tran_id`);--> statement-breakpoint
CREATE INDEX `orders_student` ON `orders` (`student_id`,`created_at`);
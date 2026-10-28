CREATE TABLE `lesson_progress` (
	`student_id` text NOT NULL,
	`course_slug` text NOT NULL,
	`lesson_id` text NOT NULL,
	`position_s` integer DEFAULT 0 NOT NULL,
	`duration_s` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_progress_student_lesson` ON `lesson_progress` (`student_id`,`course_slug`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `lesson_progress_student_recent` ON `lesson_progress` (`student_id`,`course_slug`,`updated_at`);
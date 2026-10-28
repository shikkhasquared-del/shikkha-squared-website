import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Student accounts. A student signs in with a verified phone number, Google, or both.
export const students = sqliteTable('students', {
  id: text('id').primaryKey(), name: text('name').notNull().default(''),
  phone: text('phone').unique(), email: text('email'), googleSub: text('google_sub').unique(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), lastLoginAt: text('last_login_at'),
});
// Only a SHA-256 hash of each session token is stored; the token itself lives in the student's cookie.
export const studentSessions = sqliteTable('student_sessions', {
  id: text('id').primaryKey(), studentId: text('student_id').notNull(),
  createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull(),
}, table => [index('student_sessions_student').on(table.studentId)]);
// One-time SMS sign-in codes, stored as peppered hashes with an attempt counter.
export const loginCodes = sqliteTable('login_codes', {
  id: text('id').primaryKey(), phone: text('phone').notNull(), ip: text('ip').notNull(), codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0), createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(), usedAt: text('used_at'),
}, table => [index('login_codes_phone').on(table.phone, table.createdAt), index('login_codes_ip').on(table.ip, table.createdAt)]);
// Course purchases. tran_id is the reference sent to SSLCommerz; amounts are in poisha (BDT/100).
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), tranId: text('tran_id').notNull().unique(), studentId: text('student_id').notNull(),
  courseSlug: text('course_slug').notNull(), courseTitle: text('course_title').notNull(), amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(), email: text('email').notNull(), phone: text('phone').notNull(), status: text('status').notNull(), valId: text('val_id'), bankTranId: text('bank_tran_id'),
  cardType: text('card_type'), note: text('note'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), paidAt: text('paid_at'),
}, table => [index('orders_student').on(table.studentId, table.createdAt)]);
// Which student can open which course. One row per student and course.
export const enrolments = sqliteTable('enrolments', {
  id: text('id').primaryKey(), studentId: text('student_id').notNull(), courseSlug: text('course_slug').notNull(), courseTitle: text('course_title').notNull(),
  source: text('source').notNull(), orderId: text('order_id'), createdAt: text('created_at').notNull(),
  // When access ends; empty means lifetime (crash courses). See accessEndsAt in lib/payments.ts.
  expiresAt: text('expires_at'),
}, table => [uniqueIndex('enrolments_student_course').on(table.studentId, table.courseSlug)]);
// How far each student has got in each lesson: where to resume a video, and when the lesson was finished.
// lesson_id is the lesson's id in the course record (or "i<index>" for lessons saved without one).
export const lessonProgress = sqliteTable('lesson_progress', {
  studentId: text('student_id').notNull(), courseSlug: text('course_slug').notNull(), lessonId: text('lesson_id').notNull(),
  positionS: integer('position_s').notNull().default(0), durationS: integer('duration_s').notNull().default(0),
  completedAt: text('completed_at'), updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('lesson_progress_student_lesson').on(table.studentId, table.courseSlug, table.lessonId), index('lesson_progress_student_recent').on(table.studentId, table.courseSlug, table.updatedAt)]);
// How many uploaded files (worksheets, images) the site has served each month. Each one is a read from
// Cloudflare R2, which bills past 10 million a month, so the site stops serving files at a much lower cap.
export const fileDownloads = sqliteTable('file_downloads', {
  month: text('month').primaryKey(), count: integer('count').notNull().default(0),
});

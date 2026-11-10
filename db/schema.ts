import { integer, pgTable, text, index, uniqueIndex, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Student accounts. A student signs in with a verified phone number, Google, or both.
export const students = pgTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  phone: text('phone').unique(),
  email: text('email'),
  googleSub: text('google_sub').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
// Only a SHA-256 hash of each session token is stored; the token itself lives in the student's cookie.
export const studentSessions = pgTable('student_sessions', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, table => [index('student_sessions_student').on(table.studentId)]);
// One-time SMS sign-in codes, stored as peppered hashes with an attempt counter.
export const loginCodes = pgTable('login_codes', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
  ip: text('ip').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
}, table => [index('login_codes_phone').on(table.phone, table.createdAt), index('login_codes_ip').on(table.ip, table.createdAt)]);
// Course purchases. tran_id is the reference sent to SSLCommerz; amounts are in poisha (BDT/100).
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  tranId: text('tran_id').notNull().unique(),
  studentId: text('student_id').notNull(),
  courseSlug: text('course_slug').notNull(),
  courseTitle: text('course_title').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  status: text('status').notNull(),
  valId: text('val_id'),
  bankTranId: text('bank_tran_id'),
  cardType: text('card_type'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  // When a discount code was used: the code, and the course price before the discount.
  discountCode: text('discount_code'),
  listPriceMinor: integer('list_price_minor'),
}, table => [index('orders_student').on(table.studentId, table.createdAt)]);
// Which student can open which course. One row per student and course.
export const enrolments = pgTable('enrolments', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  courseSlug: text('course_slug').notNull(),
  courseTitle: text('course_title').notNull(),
  source: text('source').notNull(),
  orderId: text('order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // When access ends; empty means lifetime (crash courses). See accessEndsAt in lib/payments.ts.
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, table => [uniqueIndex('enrolments_student_course').on(table.studentId, table.courseSlug)]);
// How far each student has got in each lesson: where to resume a video, and when the lesson was finished.
// lesson_id is the lesson's id in the course record (or "i<index>" for lessons saved without one).
export const lessonProgress = pgTable('lesson_progress', {
  studentId: text('student_id').notNull(),
  courseSlug: text('course_slug').notNull(),
  lessonId: text('lesson_id').notNull(),
  positionS: integer('position_s').notNull().default(0),
  durationS: integer('duration_s').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('lesson_progress_student_lesson').on(table.studentId, table.courseSlug, table.lessonId), index('lesson_progress_student_recent').on(table.studentId, table.courseSlug, table.updatedAt)]);
// How many uploaded files (worksheets, images) the site has served each month. Each one is a read from
// Cloudflare R2, which bills past 10 million a month, so the site stops serving files at a much lower cap.
export const fileDownloads = pgTable('file_downloads', {
  month: text('month').primaryKey(),
  count: integer('count').notNull().default(0),
});
// Discount codes the admin creates. A percentage off one course or every course, optionally limited by dates
// and number of uses. Uses are counted when a payment succeeds.
export const discountCodes = pgTable('discount_codes', {
  code: text('code').primaryKey(),
  percent: integer('percent').notNull(),
  courseSlug: text('course_slug'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  active: boolean('active').notNull().default(true),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
// Sign-ins and lesson-video starts, to spot accounts shared between people. Only an approximate place
// (city and country from Cloudflare) and a scrambled, one-way code for the network address are kept,
// never the address itself. Rows older than 90 days are deleted.
export const accountActivity = pgTable('account_activity', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  kind: text('kind').notNull(),
  network: text('network').notNull(),
  city: text('city').notNull().default(''),
  country: text('country').notNull().default(''),
  device: text('device').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('account_activity_student').on(table.studentId, table.createdAt), index('account_activity_time').on(table.createdAt)]);
// Daily message counts for the website assistant (lib/chat.ts): one row for the site and one per scrambled
// network code. No questions or answers are stored, and rows from earlier days are deleted.
export const chatUsage = pgTable('chat_usage', {
  key: text('key').primaryKey(),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
});
// Admin-managed records: courses, assets (lesson videos, PDFs), and payment ledgers.
// The website fetches the published catalogue from these records via the CMS HTTP endpoint.
export const records = pgTable('records', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  data: text('data').notNull(),
  uniqueKey: text('unique_key'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, table => [uniqueIndex('record_unique_key').on(table.kind, table.uniqueKey), index('record_kind_status').on(table.kind, table.status)]);
// Audit events for admin activity tracking.
export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  summary: text('summary').notNull(),
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

import {
  pgTable, pgEnum, uuid, text, boolean, integer, timestamp, jsonb, index,
} from 'drizzle-orm/pg-core';

// ---------- Enum ----------
export const roleEnum = pgEnum('role', ['admin', 'user']);
export const invitationMethodEnum = pgEnum('invitation_method', ['automatic', 'manual']);
export const invitationStatusEnum = pgEnum('invitation_status', ['draft', 'published']);
export const attendanceEnum = pgEnum('attendance', ['hadir', 'tidak_hadir', 'ragu']);

// ---------- users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- sessions ----------
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // hash dari token session
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

// ---------- invitations ----------
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  method: invitationMethodEnum('method').notNull(),
  status: invitationStatusEnum('status').notNull().default('draft'),
  templateKey: text('template_key').notNull().default('classic'),
  isDisabled: boolean('is_disabled').notNull().default(false), // dinonaktifkan admin
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index('invitations_user_idx').on(t.userId)]);

// ---------- invitation_contents ----------
export const invitationContents = pgTable('invitation_contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitationId: uuid('invitation_id').notNull().unique()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------- invitation_assets ----------
export const invitationAssets = pgTable('invitation_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitationId: uuid('invitation_id').notNull()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull().unique(), // nama unik di disk
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('assets_invitation_idx').on(t.invitationId)]);

// ---------- rsvps ----------
export const rsvps = pgTable('rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitationId: uuid('invitation_id').notNull()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  guestName: text('guest_name').notNull(),
  attendance: attendanceEnum('attendance').notNull(),
  guestCount: integer('guest_count').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('rsvps_invitation_idx').on(t.invitationId)]);

// ---------- guest_messages ----------
export const guestMessages = pgTable('guest_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitationId: uuid('invitation_id').notNull()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  guestName: text('guest_name').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('messages_invitation_idx').on(t.invitationId)]);

// ---------- app_settings ----------
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------- invitation_guests ----------
export const invitationGuests = pgTable('invitation_guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitationId: uuid('invitation_id').notNull()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('guests_invitation_idx').on(t.invitationId)]);
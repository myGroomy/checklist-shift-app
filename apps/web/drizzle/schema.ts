import {
  pgTable, text, integer, boolean, timestamp, jsonb, date, doublePrecision,
  uniqueIndex, index, pgEnum, bigserial,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// Enums (sesuai DATABASE_SCHEMA.md §7)
// ============================================

export const roleEnum = pgEnum('role', ['admin', 'petugas']);
export const shiftStatusEnum = pgEnum('shift_status', ['berjalan', 'ditutup', 'ditutup_paksa', 'void']);
export const closeTypeEnum = pgEnum('close_type', ['normal', 'paksa']);
export const inputTypeEnum = pgEnum('input_type', ['centang', 'foto', 'teks', 'angka', 'ok_tidak_ok']);
export const entryStateEnum = pgEnum('entry_state', ['belum', 'selesai', 'skip']);
export const timingLabelEnum = pgEnum('timing_label', ['tepat_waktu', 'lebih_awal', 'terlambat']);
export const entryActionEnum = pgEnum('entry_action', ['selesai', 'batal', 'skip', 'ubah_nilai']);
export const outcomeEnum = pgEnum('outcome', ['diterima', 'ditolak_kalah']);
export const handoverFieldTypeEnum = pgEnum('handover_field_type', ['teks', 'angka', 'pilihan', 'ya_tidak']);
export const incidentStatusEnum = pgEnum('incident_status', ['open', 'selesai']);
export const linkSourceEnum = pgEnum('link_source', ['otomatis', 'admin', 'none']);
export const severityEnum = pgEnum('severity', ['rendah', 'sedang', 'tinggi']);
export const photoOwnerTypeEnum = pgEnum('photo_owner_type', ['entry', 'handover', 'incident']);
export const photoStatusEnum = pgEnum('photo_status', ['pending', 'uploaded', 'purged']);
export const firstActionTypeEnum = pgEnum('first_action_type', ['buka_shift', 'centang', 'isi', 'skip', 'incident', 'saya_bertugas']);
export const authorRoleEnum = pgEnum('author_role', ['admin', 'petugas']);
export const valueTypeEnum = pgEnum('value_type', ['int', 'bool', 'string', 'text']);

// ============================================
// Tabel Global
// ============================================

export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  role: roleEnum('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePin: boolean('must_change_pin').notNull().default(true),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  pinChangedAt: timestamp('pin_changed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export const userBranchAccess = pgTable('user_branch_access', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  branchId: text('branch_id').notNull().references(() => branches.id),
  grantedBy: text('granted_by').notNull().references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('uix_user_branch_access').on(t.userId, t.branchId),
}));

export const incidentCategories = pgTable('incident_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  valueType: valueTypeEnum('value_type').notNull(),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  deviceInfo: text('device_info'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  idxUserActive: index('idx_sessions_user_active').on(t.userId).where(sql`${t.revokedAt} IS NULL`),
}));

export const shareTokens = pgTable('share_tokens', {
  id: text('id').primaryKey(),
  secretHash: text('secret_hash').notNull(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  reportId: text('report_id').notNull(),
  shiftInstanceId: text('shift_instance_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: text('revoked_by').references(() => users.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  deviceInfo: text('device_info'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPrefs = pgTable('notification_prefs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('uix_notification_prefs').on(t.userId, t.type),
}));

export const pinFailAttempts = pgTable('pin_fail_attempts', {
  userId: text('user_id').primaryKey().references(() => users.id),
  count: integer('count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  seq: bigserial('seq', { mode: 'number' }),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),
  objectType: text('object_type'),
  objectId: text('object_id'),
  branchId: text('branch_id').references(() => branches.id),
  shiftInstanceId: text('shift_instance_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
}, (t) => ({
  idxBranch: index('idx_audit_log_branch').on(t.branchId, t.at),
  idxActor: index('idx_audit_log_actor').on(t.actorId, t.at),
}));

// ============================================
// Tabel Template Cabang
// ============================================

export const shiftDefinitions = pgTable('shift_definitions', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  crossesMidnight: boolean('crosses_midnight').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  idxBranch: index('idx_shift_definitions_branch').on(t.branchId),
}));

export const sopCategories = pgTable('sop_categories', {
  id: text('id').primaryKey(),
  shiftDefinitionId: text('shift_definition_id').notNull().references(() => shiftDefinitions.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  idxShift: index('idx_sop_categories_shift').on(t.shiftDefinitionId),
}));

export const checklistPoints = pgTable('checklist_points', {
  id: text('id').primaryKey(),
  sopCategoryId: text('sop_category_id').notNull().references(() => sopCategories.id),
  title: text('title').notNull(),
  instruction: text('instruction'),
  inputType: inputTypeEnum('input_type').notNull(),
  isRequired: boolean('is_required').notNull().default(true),
  targetTime: text('target_time'),
  toleranceMinutes: integer('tolerance_minutes'),
  activeDays: text('active_days'),
  numberMin: doublePrecision('number_min'),
  numberMax: doublePrecision('number_max'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  idxCategory: index('idx_checklist_points_category').on(t.sopCategoryId),
}));

export const handoverFields = pgTable('handover_fields', {
  id: text('id').primaryKey(),
  shiftDefinitionId: text('shift_definition_id').notNull().references(() => shiftDefinitions.id),
  label: text('label').notNull(),
  fieldType: handoverFieldTypeEnum('field_type').notNull(),
  options: jsonb('options'),
  isRequired: boolean('is_required').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  idxShift: index('idx_handover_fields_shift').on(t.shiftDefinitionId),
}));

// ============================================
// Tabel Operasional
// ============================================

export const shiftInstances = pgTable('shift_instances', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  shiftDefinitionId: text('shift_definition_id').notNull().references(() => shiftDefinitions.id),
  shiftDate: date('shift_date').notNull(),
  status: shiftStatusEnum('status').notNull().default('berjalan'),
  pjUserId: text('pj_user_id').notNull().references(() => users.id),
  openedBy: text('opened_by').notNull().references(() => users.id),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
  openedOutsideHours: boolean('opened_outside_hours').notNull().default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: text('closed_by').references(() => users.id),
  closeType: closeTypeEnum('close_type'),
  forceCloseReason: text('force_close_reason'),
  isIncomplete: boolean('is_incomplete').notNull().default(false),
  noIncidentConfirmed: boolean('no_incident_confirmed').notNull().default(false),
  voidReason: text('void_reason'),
  voidBy: text('void_by').references(() => users.id),
  voidAt: timestamp('void_at', { withTimezone: true }),
  isTest: boolean('is_test').notNull().default(false),
  templateSnapshot: jsonb('template_snapshot').notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  uixBr01: uniqueIndex('uix_shift_br01').on(t.shiftDefinitionId, t.shiftDate, t.isTest).where(sql`${t.status} != 'void'`),
  idxBranchDate: index('idx_shift_instances_branch_date').on(t.branchId, t.shiftDate),
  idxStatus: index('idx_shift_instances_status').on(t.status).where(sql`${t.status} = 'berjalan'`),
}));

export const participants = pgTable('participants', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').notNull().references(() => shiftInstances.id),
  userId: text('user_id').notNull().references(() => users.id),
  firstActionAt: timestamp('first_action_at', { withTimezone: true }).notNull(),
  firstActionType: firstActionTypeEnum('first_action_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('uix_participants').on(t.shiftInstanceId, t.userId),
  idxShift: index('idx_participants_shift').on(t.shiftInstanceId),
}));

export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').notNull().unique().references(() => shiftInstances.id),
  reportNumber: text('report_number').notNull(),
  generatedBy: text('generated_by').notNull().references(() => users.id),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  isLocked: boolean('is_locked').notNull().default(true),
  summaryStats: jsonb('summary_stats'),
  contentHash: text('content_hash').notNull(),
  unlockCount: integer('unlock_count').notNull().default(0),
  lastUnlockedAt: timestamp('last_unlocked_at', { withTimezone: true }),
  lastUnlockedBy: text('last_unlocked_by').references(() => users.id),
  archivePdfDriveId: text('archive_pdf_drive_id'),
  archivePdfDriveUrl: text('archive_pdf_drive_url'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedPhotoCount: integer('archived_photo_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export const addenda = pgTable('addenda', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  authorId: text('author_id').notNull().references(() => users.id),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const summary = pgTable('summary', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  summaryDate: date('summary_date').notNull(),
  shiftDefinitionId: text('shift_definition_id').notNull().references(() => shiftDefinitions.id),
  shiftsTotal: integer('shifts_total').default(0),
  shiftsClosedNormal: integer('shifts_closed_normal').default(0),
  shiftsClosedForced: integer('shifts_closed_forced').default(0),
  shiftsVoid: integer('shifts_void').default(0),
  requiredTotal: integer('required_total').default(0),
  requiredDone: integer('required_done').default(0),
  requiredSkipped: integer('required_skipped').default(0),
  timedOnTime: integer('timed_on_time').default(0),
  timedEarly: integer('timed_early').default(0),
  timedLate: integer('timed_late').default(0),
  incidentsTotal: integer('incidents_total').default(0),
  incidentsOpen: integer('incidents_open').default(0),
  incidentsByCategory: jsonb('incidents_by_category'),
  handoversRead: integer('handovers_read').default(0),
  participantsCount: integer('participants_count').default(0),
  computedAt: timestamp('computed_at', { withTimezone: true }),
}, (t) => ({
  uniq: uniqueIndex('uix_summary').on(t.branchId, t.summaryDate, t.shiftDefinitionId),
}));

export const entries = pgTable('entries', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').notNull().references(() => shiftInstances.id),
  pointRef: text('point_ref').notNull(),
  state: entryStateEnum('state').notNull().default('belum'),
  value: text('value'),
  outOfRange: boolean('out_of_range').default(false),
  completedBy: text('completed_by').references(() => users.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  timingLabel: timingLabelEnum('timing_label'),
  timingDeltaMinutes: integer('timing_delta_minutes'),
  skipReason: text('skip_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  uniq: uniqueIndex('uix_entries').on(t.shiftInstanceId, t.pointRef),
  idxShift: index('idx_entries_shift').on(t.shiftInstanceId),
}));

export const entryLogs = pgTable('entry_logs', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').notNull().references(() => shiftInstances.id),
  entryId: text('entry_id').references(() => entries.id),
  pointRef: text('point_ref').notNull(),
  action: entryActionEnum('action').notNull(),
  outcome: outcomeEnum('outcome').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  winnerUserId: text('winner_user_id').references(() => users.id),
  prevState: entryStateEnum('prev_state'),
  newState: entryStateEnum('new_state'),
  value: text('value'),
  note: text('note'),
  clientActionId: text('client_action_id').notNull().unique(),
  clientAt: timestamp('client_at', { withTimezone: true }),
  at: timestamp('at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxShift: index('idx_entry_logs_shift').on(t.shiftInstanceId),
}));

export const handovers = pgTable('handovers', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').notNull().unique().references(() => shiftInstances.id),
  values: jsonb('values').notNull(),
  freeText: text('free_text'),
  submittedBy: text('submitted_by').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const handoverAcks = pgTable('handover_acks', {
  id: text('id').primaryKey(),
  handoverId: text('handover_id').notNull().references(() => handovers.id),
  readingShiftInstanceId: text('reading_shift_instance_id').notNull().references(() => shiftInstances.id),
  userId: text('user_id').notNull().references(() => users.id),
  readAt: timestamp('read_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('uix_handover_acks').on(t.handoverId, t.readingShiftInstanceId),
}));

export const photos = pgTable('photos', {
  id: text('id').primaryKey(),
  shiftInstanceId: text('shift_instance_id').references(() => shiftInstances.id),
  ownerType: photoOwnerTypeEnum('owner_type').notNull(),
  ownerId: text('owner_id').notNull(),
  fileRef: text('file_ref').notNull(),
  mime: text('mime').notNull().default('image/webp'),
  sizeBytes: integer('size_bytes'),
  width: integer('width'),
  height: integer('height'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: photoStatusEnum('status').notNull().default('pending'),
  uploadedBy: text('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxOwner: index('idx_photos_owner').on(t.ownerType, t.ownerId),
  idxUploaded: index('idx_photos_uploaded').on(t.status, t.shiftInstanceId).where(sql`${t.status} = 'uploaded'`),
}));

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  shiftInstanceId: text('shift_instance_id').references(() => shiftInstances.id),
  categoryId: text('category_id').notNull().references(() => incidentCategories.id),
  description: text('description').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  reportedBy: text('reported_by').notNull().references(() => users.id),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
  status: incidentStatusEnum('status').notNull().default('open'),
  outsideShift: boolean('outside_shift').notNull().default(false),
  linkSource: linkSourceEnum('link_source').notNull().default('none'),
  linkedBy: text('linked_by').references(() => users.id),
  linkedAt: timestamp('linked_at', { withTimezone: true }),
  sourceEntryId: text('source_entry_id').references(() => entries.id),
  severity: severityEnum('severity'),
  statusChangedBy: text('status_changed_by').references(() => users.id),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
  isTest: boolean('is_test').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
}, (t) => ({
  idxBranchStatus: index('idx_incidents_branch_status').on(t.branchId, t.status),
  idxShift: index('idx_incidents_shift').on(t.shiftInstanceId),
  idxOpen: index('idx_incidents_open').on(t.branchId, t.reportedAt).where(sql`${t.status} = 'open'`),
}));

export const incidentNotes = pgTable('incident_notes', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull().references(() => incidents.id),
  authorId: text('author_id').notNull().references(() => users.id),
  authorRole: authorRoleEnum('author_role').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxIncident: index('idx_incident_notes_incident').on(t.incidentId),
}));

// ============================================
// Notifications table (ditambahkan untuk pusat notifikasi)
// ============================================

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxUser: index('idx_notifications_user').on(t.userId, t.createdAt),
  idxUnread: index('idx_notifications_unread').on(t.userId).where(sql`${t.readAt} IS NULL`),
}));

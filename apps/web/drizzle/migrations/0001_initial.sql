-- ============================================
-- checklist-shift v2 — Initial Schema (PostgreSQL/Supabase)
-- Generated from Drizzle schema + DATABASE_SCHEMA.md
-- ============================================

-- ============================================
-- Enums
-- ============================================

CREATE TYPE "role" AS ENUM ('admin', 'petugas');
CREATE TYPE "shift_status" AS ENUM ('berjalan', 'ditutup', 'ditutup_paksa', 'void');
CREATE TYPE "close_type" AS ENUM ('normal', 'paksa');
CREATE TYPE "input_type" AS ENUM ('centang', 'foto', 'teks', 'angka', 'ok_tidak_ok');
CREATE TYPE "entry_state" AS ENUM ('belum', 'selesai', 'skip');
CREATE TYPE "timing_label" AS ENUM ('tepat_waktu', 'lebih_awal', 'terlambat');
CREATE TYPE "entry_action" AS ENUM ('selesai', 'batal', 'skip', 'ubah_nilai');
CREATE TYPE "outcome" AS ENUM ('diterima', 'ditolak_kalah');
CREATE TYPE "handover_field_type" AS ENUM ('teks', 'angka', 'pilihan', 'ya_tidak');
CREATE TYPE "incident_status" AS ENUM ('open', 'selesai');
CREATE TYPE "link_source" AS ENUM ('otomatis', 'admin', 'none');
CREATE TYPE "severity" AS ENUM ('rendah', 'sedang', 'tinggi');
CREATE TYPE "photo_owner_type" AS ENUM ('entry', 'handover', 'incident');
CREATE TYPE "photo_status" AS ENUM ('pending', 'uploaded', 'purged');
CREATE TYPE "first_action_type" AS ENUM ('buka_shift', 'centang', 'isi', 'skip', 'incident', 'saya_bertugas');
CREATE TYPE "author_role" AS ENUM ('admin', 'petugas');
CREATE TYPE "value_type" AS ENUM ('int', 'bool', 'string', 'text');

-- ============================================
-- Tabel Global
-- ============================================

CREATE TABLE "branches" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT UNIQUE NOT NULL,
  "address" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT UNIQUE NOT NULL,
  "pin_hash" TEXT NOT NULL,
  "role" "role" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "must_change_pin" BOOLEAN NOT NULL DEFAULT TRUE,
  "locked_until" TIMESTAMPTZ,
  "last_login_at" TIMESTAMPTZ,
  "pin_changed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "user_branch_access" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "granted_by" TEXT NOT NULL REFERENCES "users"("id"),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "uix_user_branch_access" ON "user_branch_access"("user_id", "branch_id");

CREATE TABLE "incident_categories" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT UNIQUE NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "settings" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "value_type" "value_type" NOT NULL,
  "updated_by" TEXT REFERENCES "users"("id"),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "device_info" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ
);
CREATE INDEX "idx_sessions_user_active" ON "sessions"("user_id") WHERE "revoked_at" IS NULL;

CREATE TABLE "share_tokens" (
  "id" TEXT PRIMARY KEY,
  "secret_hash" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "report_id" TEXT NOT NULL,
  "shift_instance_id" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "revoked_by" TEXT REFERENCES "users"("id"),
  "created_by" TEXT NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "push_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "endpoint" TEXT UNIQUE NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "device_info" TEXT,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "notification_prefs" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "uix_notification_prefs" ON "notification_prefs"("user_id", "type");

CREATE TABLE "pin_fail_attempts" (
  "user_id" TEXT PRIMARY KEY REFERENCES "users"("id"),
  "count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "audit_log" (
  "id" TEXT PRIMARY KEY,
  "seq" BIGSERIAL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actor_id" TEXT REFERENCES "users"("id"),
  "action" TEXT NOT NULL,
  "object_type" TEXT,
  "object_id" TEXT,
  "branch_id" TEXT REFERENCES "branches"("id"),
  "shift_instance_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "prev_hash" TEXT NOT NULL,
  "hash" TEXT NOT NULL
);
CREATE INDEX "idx_audit_log_branch" ON "audit_log"("branch_id", "at" DESC);
CREATE INDEX "idx_audit_log_actor" ON "audit_log"("actor_id", "at" DESC);

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "created_at" DESC);
CREATE INDEX "idx_notifications_unread" ON "notifications"("user_id") WHERE "read_at" IS NULL;

-- ============================================
-- Tabel Template Cabang
-- ============================================

CREATE TABLE "shift_definitions" (
  "id" TEXT PRIMARY KEY,
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "name" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "crosses_midnight" BOOLEAN NOT NULL DEFAULT FALSE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_shift_definitions_branch" ON "shift_definitions"("branch_id");

CREATE TABLE "sop_categories" (
  "id" TEXT PRIMARY KEY,
  "shift_definition_id" TEXT NOT NULL REFERENCES "shift_definitions"("id"),
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_sop_categories_shift" ON "sop_categories"("shift_definition_id");

CREATE TABLE "checklist_points" (
  "id" TEXT PRIMARY KEY,
  "sop_category_id" TEXT NOT NULL REFERENCES "sop_categories"("id"),
  "title" TEXT NOT NULL,
  "instruction" TEXT,
  "input_type" "input_type" NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT TRUE,
  "target_time" TEXT,
  "tolerance_minutes" INTEGER,
  "active_days" TEXT,
  "number_min" DOUBLE PRECISION,
  "number_max" DOUBLE PRECISION,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_checklist_points_category" ON "checklist_points"("sop_category_id");

CREATE TABLE "handover_fields" (
  "id" TEXT PRIMARY KEY,
  "shift_definition_id" TEXT NOT NULL REFERENCES "shift_definitions"("id"),
  "label" TEXT NOT NULL,
  "field_type" "handover_field_type" NOT NULL,
  "options" JSONB,
  "is_required" BOOLEAN NOT NULL DEFAULT FALSE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_handover_fields_shift" ON "handover_fields"("shift_definition_id");

-- ============================================
-- Tabel Operasional
-- ============================================

CREATE TABLE "shift_instances" (
  "id" TEXT PRIMARY KEY,
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "shift_definition_id" TEXT NOT NULL REFERENCES "shift_definitions"("id"),
  "shift_date" DATE NOT NULL,
  "status" "shift_status" NOT NULL DEFAULT 'berjalan',
  "pj_user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "opened_by" TEXT NOT NULL REFERENCES "users"("id"),
  "opened_at" TIMESTAMPTZ NOT NULL,
  "opened_outside_hours" BOOLEAN NOT NULL DEFAULT FALSE,
  "closed_at" TIMESTAMPTZ,
  "closed_by" TEXT REFERENCES "users"("id"),
  "close_type" "close_type",
  "force_close_reason" TEXT,
  "is_incomplete" BOOLEAN NOT NULL DEFAULT FALSE,
  "no_incident_confirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "void_reason" TEXT,
  "void_by" TEXT REFERENCES "users"("id"),
  "void_at" TIMESTAMPTZ,
  "is_test" BOOLEAN NOT NULL DEFAULT FALSE,
  "template_snapshot" JSONB NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "uix_shift_br01" ON "shift_instances"("shift_definition_id", "shift_date", "is_test") WHERE "status" != 'void';
CREATE INDEX "idx_shift_instances_branch_date" ON "shift_instances"("branch_id", "shift_date" DESC);
CREATE INDEX "idx_shift_instances_status" ON "shift_instances"("status") WHERE "status" = 'berjalan';

CREATE TABLE "participants" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT NOT NULL REFERENCES "shift_instances"("id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "first_action_at" TIMESTAMPTZ NOT NULL,
  "first_action_type" "first_action_type" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "uix_participants" ON "participants"("shift_instance_id", "user_id");
CREATE INDEX "idx_participants_shift" ON "participants"("shift_instance_id");

CREATE TABLE "reports" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT UNIQUE NOT NULL REFERENCES "shift_instances"("id"),
  "report_number" TEXT NOT NULL,
  "generated_by" TEXT NOT NULL REFERENCES "users"("id"),
  "generated_at" TIMESTAMPTZ NOT NULL,
  "is_locked" BOOLEAN NOT NULL DEFAULT TRUE,
  "summary_stats" JSONB,
  "content_hash" TEXT NOT NULL,
  "unlock_count" INTEGER NOT NULL DEFAULT 0,
  "last_unlocked_at" TIMESTAMPTZ,
  "last_unlocked_by" TEXT REFERENCES "users"("id"),
  "archive_pdf_drive_id" TEXT,
  "archive_pdf_drive_url" TEXT,
  "archived_at" TIMESTAMPTZ,
  "archived_photo_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "addenda" (
  "id" TEXT PRIMARY KEY,
  "report_id" TEXT NOT NULL REFERENCES "reports"("id"),
  "author_id" TEXT NOT NULL REFERENCES "users"("id"),
  "note" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "summary" (
  "id" TEXT PRIMARY KEY,
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "summary_date" DATE NOT NULL,
  "shift_definition_id" TEXT NOT NULL REFERENCES "shift_definitions"("id"),
  "shifts_total" INTEGER DEFAULT 0,
  "shifts_closed_normal" INTEGER DEFAULT 0,
  "shifts_closed_forced" INTEGER DEFAULT 0,
  "shifts_void" INTEGER DEFAULT 0,
  "required_total" INTEGER DEFAULT 0,
  "required_done" INTEGER DEFAULT 0,
  "required_skipped" INTEGER DEFAULT 0,
  "timed_on_time" INTEGER DEFAULT 0,
  "timed_early" INTEGER DEFAULT 0,
  "timed_late" INTEGER DEFAULT 0,
  "incidents_total" INTEGER DEFAULT 0,
  "incidents_open" INTEGER DEFAULT 0,
  "incidents_by_category" JSONB,
  "handovers_read" INTEGER DEFAULT 0,
  "participants_count" INTEGER DEFAULT 0,
  "computed_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "uix_summary" ON "summary"("branch_id", "summary_date", "shift_definition_id");

CREATE TABLE "entries" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT NOT NULL REFERENCES "shift_instances"("id"),
  "point_ref" TEXT NOT NULL,
  "state" "entry_state" NOT NULL DEFAULT 'belum',
  "value" TEXT,
  "out_of_range" BOOLEAN DEFAULT FALSE,
  "completed_by" TEXT REFERENCES "users"("id"),
  "completed_at" TIMESTAMPTZ,
  "timing_label" "timing_label",
  "timing_delta_minutes" INTEGER,
  "skip_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "uix_entries" ON "entries"("shift_instance_id", "point_ref");
CREATE INDEX "idx_entries_shift" ON "entries"("shift_instance_id");

CREATE TABLE "entry_logs" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT NOT NULL REFERENCES "shift_instances"("id"),
  "entry_id" TEXT REFERENCES "entries"("id"),
  "point_ref" TEXT NOT NULL,
  "action" "entry_action" NOT NULL,
  "outcome" "outcome" NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "winner_user_id" TEXT REFERENCES "users"("id"),
  "prev_state" "entry_state",
  "new_state" "entry_state",
  "value" TEXT,
  "note" TEXT,
  "client_action_id" TEXT UNIQUE NOT NULL,
  "client_at" TIMESTAMPTZ,
  "at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_entry_logs_shift" ON "entry_logs"("shift_instance_id");

CREATE TABLE "handovers" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT UNIQUE NOT NULL REFERENCES "shift_instances"("id"),
  "values" JSONB NOT NULL,
  "free_text" TEXT,
  "submitted_by" TEXT NOT NULL REFERENCES "users"("id"),
  "submitted_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "handover_acks" (
  "id" TEXT PRIMARY KEY,
  "handover_id" TEXT NOT NULL REFERENCES "handovers"("id"),
  "reading_shift_instance_id" TEXT NOT NULL REFERENCES "shift_instances"("id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "read_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "uix_handover_acks" ON "handover_acks"("handover_id", "reading_shift_instance_id");

CREATE TABLE "photos" (
  "id" TEXT PRIMARY KEY,
  "shift_instance_id" TEXT REFERENCES "shift_instances"("id"),
  "owner_type" "photo_owner_type" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "file_ref" TEXT NOT NULL,
  "mime" TEXT NOT NULL DEFAULT 'image/webp',
  "size_bytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "photo_status" NOT NULL DEFAULT 'pending',
  "uploaded_by" TEXT REFERENCES "users"("id"),
  "uploaded_at" TIMESTAMPTZ,
  "purged_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_photos_owner" ON "photos"("owner_type", "owner_id");
CREATE INDEX "idx_photos_uploaded" ON "photos"("status", "shift_instance_id") WHERE "status" = 'uploaded';

CREATE TABLE "incidents" (
  "id" TEXT PRIMARY KEY,
  "branch_id" TEXT NOT NULL REFERENCES "branches"("id"),
  "shift_instance_id" TEXT REFERENCES "shift_instances"("id"),
  "category_id" TEXT NOT NULL REFERENCES "incident_categories"("id"),
  "description" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "reported_by" TEXT NOT NULL REFERENCES "users"("id"),
  "reported_at" TIMESTAMPTZ NOT NULL,
  "status" "incident_status" NOT NULL DEFAULT 'open',
  "outside_shift" BOOLEAN NOT NULL DEFAULT FALSE,
  "link_source" "link_source" NOT NULL DEFAULT 'none',
  "linked_by" TEXT REFERENCES "users"("id"),
  "linked_at" TIMESTAMPTZ,
  "source_entry_id" TEXT REFERENCES "entries"("id"),
  "severity" "severity",
  "status_changed_by" TEXT REFERENCES "users"("id"),
  "status_changed_at" TIMESTAMPTZ,
  "is_test" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_incidents_branch_status" ON "incidents"("branch_id", "status");
CREATE INDEX "idx_incidents_shift" ON "incidents"("shift_instance_id");
CREATE INDEX "idx_incidents_open" ON "incidents"("branch_id", "reported_at" DESC) WHERE "status" = 'open';

CREATE TABLE "incident_notes" (
  "id" TEXT PRIMARY KEY,
  "incident_id" TEXT NOT NULL REFERENCES "incidents"("id"),
  "author_id" TEXT NOT NULL REFERENCES "users"("id"),
  "author_role" "author_role" NOT NULL,
  "note" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_incident_notes_incident" ON "incident_notes"("incident_id");

-- ============================================
-- Seed: Default Settings
-- ============================================

INSERT INTO "settings" ("key", "value", "value_type") VALUES
  ('tolerance_default_minutes', '15', 'int'),
  ('pin_max_attempts', '5', 'int'),
  ('pin_lock_minutes', '15', 'int'),
  ('session_days', '30', 'int'),
  ('share_token_days', '30', 'int'),
  ('incident_link_window_hours', '4', 'int'),
  ('photo_max_count', '5', 'int'),
  ('photo_max_size_kb', '150', 'int'),
  ('photo_retention_days', '0', 'int'),
  ('public_show_photos', 'TRUE', 'bool'),
  ('pin_block_weak', 'TRUE', 'bool'),
  ('whatsapp_template', '{cabang} {tanggal} {shift} {pj} {ringkasan} {tautan}', 'text')
ON CONFLICT ("key") DO NOTHING;

-- ============================================
-- Seed: Default Incident Categories
-- ============================================

INSERT INTO "incident_categories" ("id", "name", "sort_order") VALUES
  ('cat_void_transaction', 'Void Transaction', 1),
  ('cat_menu_basi', 'Menu Basi', 2),
  ('cat_kecelakaan_kerja', 'Kecelakaan Kerja', 3),
  ('cat_kerusakan_peralatan', 'Kerusakan Peralatan', 4),
  ('cat_komplain', 'Komplain', 5),
  ('cat_keamanan', 'Keamanan', 6),
  ('cat_lainnya', 'Lainnya', 7)
ON CONFLICT ("id") DO NOTHING;

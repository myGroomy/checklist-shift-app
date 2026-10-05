import { z } from 'zod';

// ============================================
// Enum Zod — harus identik dengan DATABASE_SCHEMA.md §7
// ============================================

export const roleSchema = z.enum(['admin', 'petugas']);

export const shiftStatusSchema = z.enum(['berjalan', 'ditutup', 'ditutup_paksa', 'void']);

export const closeTypeSchema = z.enum(['normal', 'paksa']);

export const inputTypeSchema = z.enum(['centang', 'foto', 'teks', 'angka', 'ok_tidak_ok']);

export const entryStateSchema = z.enum(['belum', 'selesai', 'skip']);

export const timingLabelSchema = z.enum(['tepat_waktu', 'lebih_awal', 'terlambat']);

export const entryActionSchema = z.enum(['selesai', 'batal', 'skip', 'ubah_nilai']);

export const outcomeSchema = z.enum(['diterima', 'ditolak_kalah']);

export const handoverFieldTypeSchema = z.enum(['teks', 'angka', 'pilihan', 'ya_tidak']);

export const incidentStatusSchema = z.enum(['open', 'selesai']);

export const linkSourceSchema = z.enum(['otomatis', 'admin', 'none']);

export const severitySchema = z.enum(['rendah', 'sedang', 'tinggi']);

export const photoOwnerTypeSchema = z.enum(['entry', 'handover', 'incident']);

export const photoStatusSchema = z.enum(['pending', 'uploaded', 'purged']);

export const firstActionTypeSchema = z.enum(['buka_shift', 'centang', 'isi', 'skip', 'incident', 'saya_bertugas']);

export const authorRoleSchema = z.enum(['admin', 'petugas']);

export const valueTypeSchema = z.enum(['int', 'bool', 'string', 'text']);

// ============================================
// Type exports
// ============================================

export type Role = z.infer<typeof roleSchema>;
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;
export type CloseType = z.infer<typeof closeTypeSchema>;
export type InputType = z.infer<typeof inputTypeSchema>;
export type EntryState = z.infer<typeof entryStateSchema>;
export type TimingLabel = z.infer<typeof timingLabelSchema>;
export type EntryAction = z.infer<typeof entryActionSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type HandoverFieldType = z.infer<typeof handoverFieldTypeSchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type LinkSource = z.infer<typeof linkSourceSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type PhotoOwnerType = z.infer<typeof photoOwnerTypeSchema>;
export type PhotoStatus = z.infer<typeof photoStatusSchema>;
export type FirstActionType = z.infer<typeof firstActionTypeSchema>;
export type AuthorRole = z.infer<typeof authorRoleSchema>;
export type ValueType = z.infer<typeof valueTypeSchema>;

// ============================================
// Settings schema
// ============================================

export const settingsValueSchema = z.object({
  key: z.string(),
  value: z.string(),
  value_type: valueTypeSchema,
});

export type SettingsValue = z.infer<typeof settingsValueSchema>;

// ============================================
// Auth Zod Schemas
// ============================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  pin: z.string().length(6, 'PIN harus 6 digit angka').regex(/^\d{6}$/, 'PIN harus berupa 6 angka'),
});

export const changePinSchema = z
  .object({
    oldPin: z.string().length(6, 'PIN lama harus 6 digit'),
    newPin: z.string().length(6, 'PIN baru harus 6 digit').regex(/^\d{6}$/, 'PIN baru harus berupa 6 angka'),
    confirmPin: z.string().length(6, 'Konfirmasi PIN harus 6 digit'),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: 'Konfirmasi PIN tidak cocok',
    path: ['confirmPin'],
  })
  .refine((data) => data.oldPin !== data.newPin, {
    message: 'PIN baru harus berbeda dengan PIN lama',
    path: ['newPin'],
  });

export const sensitiveActionSchema = z.object({
  pin: z.string().length(6, 'PIN konfirmasi harus 6 digit').regex(/^\d{6}$/, 'PIN harus 6 angka'),
  reason: z.string().min(3, 'Alasan minimal 3 karakter'),
});

export const branchSchema = z.object({
  name: z.string().min(2, 'Nama cabang minimal 2 karakter'),
  code: z.string().min(2, 'Kode cabang minimal 2 karakter').max(10, 'Kode cabang maksimal 10 karakter'),
  address: z.string().optional(),
  timezone: z.string().min(1, 'Timezone IANA wajib diisi (misal: Asia/Jakarta)'),
  isActive: z.boolean().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  username: z.string().min(3, 'Username minimal 3 karakter').regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya huruf, angka, titik, strip, underscore'),
  initialPin: z.string().length(6, 'PIN awal harus 6 digit').regex(/^\d{6}$/, 'PIN harus 6 angka'),
  role: z.enum(['admin', 'petugas']),
  branchIds: z.array(z.string()).min(1, 'Pilih minimal satu cabang untuk akses'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  role: z.enum(['admin', 'petugas']).optional(),
  branchIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const incidentCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori incident minimal 2 karakter'),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
});

export const shiftDefinitionSchema = z.object({
  name: z.string().min(2, 'Nama shift minimal 2 karakter'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu harus HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu harus HH:mm'),
  crossesMidnight: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const sopCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter'),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const checklistPointSchema = z.object({
  title: z.string().min(2, 'Judul checklist minimal 2 karakter'),
  instruction: z.string().optional().nullable(),
  inputType: z.enum(['centang', 'foto', 'teks', 'angka', 'ok_tidak_ok']),
  isRequired: z.boolean().optional(),
  targetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu target harus HH:mm').optional().nullable(),
  toleranceMinutes: z.number().int().min(0).optional().nullable(),
  activeDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1, 'Pilih minimal satu hari aktif'),
  numberMin: z.number().optional().nullable(),
  numberMax: z.number().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const handoverFieldSchema = z.object({
  label: z.string().min(2, 'Label bidang serah terima minimal 2 karakter'),
  fieldType: z.enum(['teks', 'angka', 'pilihan', 'ya_tidak']),
  options: z.array(z.string()).optional().nullable(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type SensitiveActionInput = z.infer<typeof sensitiveActionSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type IncidentCategoryInput = z.infer<typeof incidentCategorySchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ShiftDefinitionInput = z.infer<typeof shiftDefinitionSchema>;
export type SopCategoryInput = z.infer<typeof sopCategorySchema>;
export type ChecklistPointInput = z.infer<typeof checklistPointSchema>;
export type HandoverFieldInput = z.infer<typeof handoverFieldSchema>;




export const DEFAULT_SETTINGS: SettingsValue[] = [
  { key: 'tolerance_default_minutes', value: '15', value_type: 'int' },
  { key: 'pin_max_attempts', value: '5', value_type: 'int' },
  { key: 'pin_lock_minutes', value: '15', value_type: 'int' },
  { key: 'session_days', value: '30', value_type: 'int' },
  { key: 'share_token_days', value: '30', value_type: 'int' },
  { key: 'incident_link_window_hours', value: '4', value_type: 'int' },
  { key: 'photo_max_count', value: '5', value_type: 'int' },
  { key: 'photo_max_size_kb', value: '150', value_type: 'int' },
  { key: 'photo_retention_days', value: '0', value_type: 'int' },
  { key: 'public_show_photos', value: 'TRUE', value_type: 'bool' },
  { key: 'pin_block_weak', value: 'TRUE', value_type: 'bool' },
  { key: 'whatsapp_template', value: '{cabang} {tanggal} {shift} {pj} {ringkasan} {tautan}', value_type: 'text' },
];

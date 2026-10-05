export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: string;
  code?: string;
}

function isErrorBody(v: unknown): v is ErrorBody {
  return typeof v === 'object' && v !== null && 'error' in v;
}

/**
 * Fetch helper untuk halaman admin:
 * - selalu menyertakan header CSRF `X-Requested-With: fetch`
 * - 401 -> redirect /login; MUST_CHANGE_PIN -> redirect /ganti-pin
 * - galat -> lempar ApiError dengan pesan dari server
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'fetch',
    ...(init?.headers as Record<string, string> | undefined),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  const res = await fetch(path, { ...init, headers, body });

  let data: unknown = null;
  try {
    data = (await res.json()) as unknown;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = isErrorBody(data) ? data : null;
    if (res.status === 401) {
      window.location.href = '/login';
      throw new ApiError('Sesi berakhir. Silakan login ulang.', 401);
    }
    if (err?.code === 'MUST_CHANGE_PIN') {
      window.location.href = '/ganti-pin';
      throw new ApiError('Anda wajib mengubah PIN terlebih dahulu.', 403, 'MUST_CHANGE_PIN');
    }
    throw new ApiError(
      err?.error || 'Terjadi kesalahan pada server',
      res.status,
      err?.code
    );
  }

  return data as T;
}

export interface AdminBranch {
  id: string;
  code: string;
  name: string;
  timezone: string;
  isActive: boolean;
}

export interface ShiftDefinition {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  sortOrder: number | null;
  isActive: boolean;
}

export interface SopCategory {
  id: string;
  shiftDefinitionId: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
}

export type InputType = 'centang' | 'foto' | 'teks' | 'angka' | 'ok_tidak_ok';

export interface ChecklistPoint {
  id: string;
  sopCategoryId: string;
  title: string;
  instruction: string | null;
  inputType: InputType;
  isRequired: boolean;
  targetTime: string | null;
  toleranceMinutes: number | null;
  activeDays: string | null;
  numberMin: number | null;
  numberMax: number | null;
  sortOrder: number;
  isActive: boolean;
}

export type HandoverFieldType = 'teks' | 'angka' | 'pilihan' | 'ya_tidak';

export interface HandoverField {
  id: string;
  shiftDefinitionId: string;
  label: string;
  fieldType: HandoverFieldType;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface ShiftPreview {
  shift: ShiftDefinition;
  handoverFields: HandoverField[];
  categories: (SopCategory & { points: ChecklistPoint[] })[];
}

export const listBranches = () =>
  apiFetch<{ branches: AdminBranch[] }>('/api/admin/branches');

export const listShifts = (branchId: string) =>
  apiFetch<{ shifts: ShiftDefinition[] }>(`/api/admin/branches/${branchId}/shifts`);

export const createShift = (branchId: string, body: unknown) =>
  apiFetch<{ message: string; shiftId: string }>(`/api/admin/branches/${branchId}/shifts`, {
    method: 'POST',
    json: body,
  });

export const updateShift = (id: string, body: unknown) =>
  apiFetch<{ message: string }>(`/api/admin/shifts/${id}`, { method: 'PUT', json: body });

export const deactivateShift = (id: string) =>
  apiFetch<{ message: string }>(`/api/admin/shifts/${id}`, { method: 'DELETE' });

export const copyFromBranch = (targetBranchId: string, sourceBranchId: string) =>
  apiFetch<{ message: string }>(`/api/admin/branches/${targetBranchId}/copy-from/${sourceBranchId}`, {
    method: 'POST',
  });

export const listCategories = (shiftId: string) =>
  apiFetch<{ categories: SopCategory[] }>(`/api/admin/shifts/${shiftId}/categories`);

export const createCategory = (shiftId: string, body: unknown) =>
  apiFetch<{ message: string; categoryId: string }>(`/api/admin/shifts/${shiftId}/categories`, {
    method: 'POST',
    json: body,
  });

export const updateCategory = (id: string, body: unknown) =>
  apiFetch<{ message: string }>(`/api/admin/sop-categories/${id}`, { method: 'PUT', json: body });

export const deactivateCategory = (id: string) =>
  apiFetch<{ message: string }>(`/api/admin/sop-categories/${id}`, { method: 'DELETE' });

export const listPoints = (categoryId: string) =>
  apiFetch<{ points: ChecklistPoint[] }>(`/api/admin/sop-categories/${categoryId}/points`);

export const createPoint = (categoryId: string, body: unknown) =>
  apiFetch<{ message: string; pointId: string }>(`/api/admin/sop-categories/${categoryId}/points`, {
    method: 'POST',
    json: body,
  });

export const updatePoint = (id: string, body: unknown) =>
  apiFetch<{ message: string }>(`/api/admin/checklist-points/${id}`, { method: 'PUT', json: body });

export const deactivatePoint = (id: string) =>
  apiFetch<{ message: string }>(`/api/admin/checklist-points/${id}`, { method: 'DELETE' });

export const listHandoverFields = (shiftId: string) =>
  apiFetch<{ fields: HandoverField[] }>(`/api/admin/shifts/${shiftId}/handover-fields`);

export const createHandoverField = (shiftId: string, body: unknown) =>
  apiFetch<{ message: string; fieldId: string }>(`/api/admin/shifts/${shiftId}/handover-fields`, {
    method: 'POST',
    json: body,
  });

export const updateHandoverField = (id: string, body: unknown) =>
  apiFetch<{ message: string }>(`/api/admin/handover-fields/${id}`, { method: 'PUT', json: body });

export const deactivateHandoverField = (id: string) =>
  apiFetch<{ message: string }>(`/api/admin/handover-fields/${id}`, { method: 'DELETE' });

export const duplicateShift = (id: string) =>
  apiFetch<{ message: string; shiftId: string }>(`/api/admin/shifts/${id}/duplicate`, { method: 'POST' });

export const duplicateCategory = (id: string) =>
  apiFetch<{ message: string; categoryId: string }>(`/api/admin/sop-categories/${id}/duplicate`, {
    method: 'POST',
  });

export const duplicatePoint = (id: string) =>
  apiFetch<{ message: string; pointId: string }>(`/api/admin/checklist-points/${id}/duplicate`, {
    method: 'POST',
  });

export const fetchShiftPreview = (shiftId: string) =>
  apiFetch<ShiftPreview>(`/api/admin/shifts/${shiftId}/preview`);

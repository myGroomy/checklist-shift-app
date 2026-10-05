import { and, eq, inArray } from 'drizzle-orm';
import { db } from './index';
import { checklistPoints, handoverFields, settings, sopCategories, shiftDefinitions } from '../../drizzle/schema';

interface SnapshotPoint {
  point_ref: string;
  title: string;
  instruction: string | null;
  input_type: string;
  is_required: boolean;
  target_time: string | null;
  tolerance_minutes: number | null;
  active_days: string | null;
  number_min: number | null;
  number_max: number | null;
  sort_order: number;
}

export interface SnapshotCategory {
  id: string;
  name: string;
  sort_order: number;
  points: SnapshotPoint[];
}

export interface Snapshot {
  v: number;
  shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    crosses_midnight: boolean;
  };
  settings: {
    tolerance_default_minutes: number;
    timezone: string;
  };
  categories: SnapshotCategory[];
  handover_fields: {
    id: string;
    label: string;
    field_type: string;
    options: string[] | null;
    is_required: boolean;
    sort_order: number;
  }[];
}

/**
 * Bangun template snapshot untuk shift instance (BR-05).
 * Query checklist_points + handover_fields aktif untuk shift definition tertentu.
 */
export async function buildTemplateSnapshot(
  shiftDefinitionId: string,
  timezone: string
): Promise<Snapshot> {
  // Get shift definition
  const [shiftDef] = await db
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.id, shiftDefinitionId))
    .limit(1);

  if (!shiftDef) {
    throw new Error(`Shift definition ${shiftDefinitionId} tidak ditemukan`);
  }

  // Get tolerance default from settings
  const [toleranceSetting] = await db
    .select()
    .from(settings)
  .where(eq(settings.key, 'tolerance_default_minutes'))
    .limit(1);
  const toleranceDefault = toleranceSetting ? parseInt(toleranceSetting.value) : 15;

  // Get SOP categories
  const categories = await db
    .select()
    .from(sopCategories)
    .where(
      and(
        eq(sopCategories.shiftDefinitionId, shiftDefinitionId),
        eq(sopCategories.isActive, true)
      )
    )
    .orderBy(sopCategories.sortOrder);

  // Get checklist points for all categories
  const categoryIds = categories.map((c) => c.id);
  const points = categoryIds.length > 0
    ? await db
        .select()
        .from(checklistPoints)
        .where(
          and(
            inArray(checklistPoints.sopCategoryId, categoryIds),
            eq(checklistPoints.isActive, true)
          )
        )
        .orderBy(checklistPoints.sortOrder)
    : [];

  // Get handover fields
  const handoverFieldsResult = await db
    .select()
    .from(handoverFields)
    .where(
      and(
        eq(handoverFields.shiftDefinitionId, shiftDefinitionId),
        eq(handoverFields.isActive, true)
      )
    )
    .orderBy(handoverFields.sortOrder);

  // Build snapshot
  const snapshot: Snapshot = {
    v: 1,
    shift: {
      id: shiftDef.id,
      name: shiftDef.name,
      start_time: shiftDef.startTime,
      end_time: shiftDef.endTime,
      crosses_midnight: shiftDef.crossesMidnight,
    },
    settings: {
      tolerance_default_minutes: toleranceDefault,
      timezone,
    },
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sort_order: cat.sortOrder,
      points: points
        .filter((p) => p.sopCategoryId === cat.id)
        .map((p) => ({
          point_ref: p.id,
          title: p.title,
          instruction: p.instruction,
          input_type: p.inputType,
          is_required: p.isRequired,
          target_time: p.targetTime,
          tolerance_minutes: p.toleranceMinutes,
          active_days: p.activeDays,
          number_min: p.numberMin,
          number_max: p.numberMax,
          sort_order: p.sortOrder,
        })),
    })),
    handover_fields: handoverFieldsResult.map((f) => ({
      id: f.id,
      label: f.label,
      field_type: f.fieldType,
      options: f.options ? (f.options as string[]) : null,
      is_required: f.isRequired,
      sort_order: f.sortOrder,
    })),
  };

  return snapshot;
}

'use client';

import { useState } from 'react';
import { Copy, FolderPlus, GripVertical, Pencil, Plus, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ChecklistPoint, SopCategory } from '@/lib/admin/api';

export type CategoryWithPoints = SopCategory & { points: ChecklistPoint[] };

interface CategoryTreeProps {
  categories: CategoryWithPoints[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onAddCategory: () => void;
  onEditCategory: (category: SopCategory) => void;
  onToggleCategory: (category: SopCategory) => void;
  onAddPoint: (categoryId: string) => void;
  onEditPoint: (point: ChecklistPoint) => void;
  onTogglePoint: (point: ChecklistPoint) => void;
  onDuplicateCategory: (category: SopCategory) => void;
  onDuplicatePoint: (point: ChecklistPoint) => void;
  onReorderCategory: (from: number, to: number) => void;
  onReorderPoint: (categoryId: string, from: number, to: number) => void;
  busyId?: string | null;
}

const INPUT_TYPE_LABEL: Record<string, string> = {
  centang: 'Centang',
  foto: 'Foto',
  teks: 'Teks',
  angka: 'Angka',
  ok_tidak_ok: 'OK / Tidak OK',
};

/**
 * Pohon Kategori SOP + item checklist dengan drag & drop urutan (HTML5 native,
 * tanpa dependensi tambahan).
 */
export function CategoryTree({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onToggleCategory,
  onAddPoint,
  onEditPoint,
  onTogglePoint,
  onDuplicateCategory,
  onDuplicatePoint,
  onReorderCategory,
  onReorderPoint,
  busyId,
}: CategoryTreeProps) {
  const [dragCategory, setDragCategory] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{ categoryId: string; index: number } | null>(
    null
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Kategori &amp; Item</h2>
        <Button size="sm" onClick={onAddCategory}>
          <FolderPlus className="h-3.5 w-3.5" />
          Kategori
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-ink-muted">
          Belum ada kategori SOP pada shift ini
        </p>
      )}

      <ul className="space-y-2">
        {categories.map((cat, catIndex) => (
          <li
            key={cat.id}
            draggable
            onDragStart={() => setDragCategory(catIndex)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragCategory !== null) onReorderCategory(dragCategory, catIndex);
              setDragCategory(null);
            }}
            onDragEnd={() => setDragCategory(null)}
            className={`rounded-lg border ${
              selectedCategoryId === cat.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface'
            }`}
          >
            <div className="flex min-h-[48px] items-center gap-2 p-2">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-muted" aria-hidden />
              <button
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium">{cat.name}</span>
                <span className="block text-xs text-ink-muted">
                  {cat.points.filter((p) => p.isActive).length} item aktif
                </span>
              </button>
              <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                {cat.isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Tambah item pada ${cat.name}`}
                onClick={() => onAddPoint(cat.id)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Duplikasi kategori ${cat.name}`}
                disabled={busyId === cat.id}
                onClick={() => onDuplicateCategory(cat)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Ubah kategori ${cat.name}`}
                onClick={() => onEditCategory(cat)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${cat.isActive ? 'Nonaktifkan' : 'Aktifkan'} kategori ${cat.name}`}
                onClick={() => onToggleCategory(cat)}
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            </div>
            {cat.points.length > 0 && (
              <ul className="border-t border-border">
                {cat.points.map((point, pointIndex) => (
                  <li
                    key={point.id}
                    draggable
                    onDragStart={() => setDragPoint({ categoryId: cat.id, index: pointIndex })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragPoint && dragPoint.categoryId === cat.id) {
                        onReorderPoint(cat.id, dragPoint.index, pointIndex);
                      }
                      setDragPoint(null);
                    }}
                    onDragEnd={() => setDragPoint(null)}
                    className="flex min-h-[48px] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0"
                  >
                    <GripVertical
                      className="h-4 w-4 shrink-0 cursor-grab text-ink-muted"
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => onSelectCategory(cat.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm">
                        {point.title}
                        {point.isRequired && <span className="text-danger"> *</span>}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {INPUT_TYPE_LABEL[point.inputType] ?? point.inputType}
                        {point.targetTime ? ` · ${point.targetTime}` : ''}
                      </span>
                    </button>
                    {!point.isActive && <Badge variant="secondary">Nonaktif</Badge>}
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Duplikasi item ${point.title}`}
                      disabled={busyId === point.id}
                      onClick={() => onDuplicatePoint(point)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Ubah item ${point.title}`}
                      onClick={() => onEditPoint(point)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`${point.isActive ? 'Nonaktifkan' : 'Aktifkan'} item ${point.title}`}
                      onClick={() => onTogglePoint(point)}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Info, Loader2, Search, X } from 'lucide-react';

export type RolePermissionItem = {
  id: number;
  name: string;
  module?: string;
  category?: string;
  description?: string;
};

export interface RoleFormValues {
  name: string;
  description: string;
  permission_ids: number[];
}

interface RoleFormProps {
  formId?: string;
  values: RoleFormValues;
  onChange: (values: RoleFormValues) => void;
  groupedPermissions: Record<string, RolePermissionItem[]>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onShowPermissionInfo?: (permission: RolePermissionItem) => void;
}

// Gunakan suffix setelah "." hanya jika seluruh permission dalam modul punya prefix yang sama & unik
function buildPermissionLabels(items: RolePermissionItem[]): Record<number, string> {
  const prefixes = new Set(
    items.map((p) => {
      const idx = p.name.indexOf('.');
      return idx >= 0 ? p.name.slice(0, idx) : '';
    })
  );
  const suffixes = items.map((p) => {
    const idx = p.name.indexOf('.');
    return idx >= 0 ? p.name.slice(idx + 1) : p.name;
  });
  const canStrip =
    prefixes.size === 1 &&
    !prefixes.has('') &&
    new Set(suffixes).size === items.length;

  const map: Record<number, string> = {};
  items.forEach((p, i) => {
    map[p.id] = canStrip ? suffixes[i] : p.name;
  });
  return map;
}

export function RoleForm({
  formId = 'role-form',
  values,
  onChange,
  groupedPermissions,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
  onShowPermissionInfo,
}: RoleFormProps) {
  const [search, setSearch] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);

  const selected = useMemo(() => new Set(values.permission_ids), [values.permission_ids]);

  const allIds = useMemo(
    () => Object.values(groupedPermissions).flatMap((items) => items.map((p) => p.id)),
    [groupedPermissions]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(groupedPermissions)
      .map(([module, items]) => {
        const moduleMatches = q && module.toLowerCase().includes(q);
        const visible = items.filter((p) => {
          if (selectedOnly && !selected.has(p.id)) return false;
          if (!q || moduleMatches) return true;
          return [p.name, p.category, p.description].filter(Boolean).join(' ').toLowerCase().includes(q);
        });
        return { module, items, visible };
      })
      .filter((row) => row.visible.length > 0)
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [groupedPermissions, search, selectedOnly, selected]);

  const activeModuleCount = useMemo(
    () => Object.values(groupedPermissions).filter((items) => items.some((p) => selected.has(p.id))).length,
    [groupedPermissions, selected]
  );

  const setIds = (ids: number[]) => onChange({ ...values, permission_ids: ids });

  const togglePermission = (id: number) => {
    setIds(selected.has(id) ? values.permission_ids.filter((x) => x !== id) : [...values.permission_ids, id]);
  };

  const toggleGroup = (ids: number[]) => {
    const allOn = ids.every((id) => selected.has(id));
    if (allOn) {
      const drop = new Set(ids);
      setIds(values.permission_ids.filter((id) => !drop.has(id)));
    } else {
      setIds([...new Set([...values.permission_ids, ...ids])]);
    }
  };

  const visibleIds = rows.flatMap((r) => r.visible.map((p) => p.id));

  return (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col">
      {/* Identitas + ringkasan */}
      <div className="grid gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
        <div className="space-y-1">
          <Label htmlFor="role-name" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nama Role <span className="text-destructive">*</span>
          </Label>
          <Input
            id="role-name"
            required
            placeholder="Contoh: Admin Rawat Jalan"
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-desc" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deskripsi
          </Label>
          <Textarea
            id="role-desc"
            rows={1}
            placeholder="Jelaskan ruang lingkup dan tujuan role ini..."
            value={values.description}
            onChange={(e) => onChange({ ...values, description: e.target.value })}
            className="min-h-8 resize-none py-1.5 text-xs"
          />
        </div>
        <div className="flex items-stretch divide-x divide-border border border-border bg-muted/30 font-mono">
          <div className="px-3 py-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Permission</div>
            <div className="text-sm font-bold tabular-nums">
              {values.permission_ids.length}
              <span className="text-xs font-normal text-muted-foreground">/{allIds.length}</span>
            </div>
          </div>
          <div className="px-3 py-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Modul Aktif</div>
            <div className="text-sm font-bold tabular-nums">
              {activeModuleCount}
              <span className="text-xs font-normal text-muted-foreground">/{Object.keys(groupedPermissions).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar permission */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari modul atau permission..."
            className="h-8 bg-background pl-8 pr-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={selectedOnly ? 'default' : 'outline'}
          className="h-8 text-xs"
          onClick={() => setSelectedOnly((v) => !v)}
        >
          Hanya Terpilih
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setIds(allIds)}
            disabled={values.permission_ids.length === allIds.length}
          >
            Pilih Semua
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setIds([...new Set([...values.permission_ids, ...visibleIds])])}
            disabled={visibleIds.length === 0}
          >
            Pilih Terlihat
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setIds([])}
            disabled={values.permission_ids.length === 0}
          >
            Kosongkan
          </Button>
        </div>
      </div>

      {/* Matriks modul x aksi */}
      <div className="flex-1 divide-y divide-border/70">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-muted-foreground">
            Tidak ada modul atau permission yang cocok dengan pencarian.
          </div>
        ) : (
          rows.map(({ module, items, visible }) => {
            const ids = items.map((p) => p.id);
            const count = ids.filter((id) => selected.has(id)).length;
            const allOn = count === ids.length;
            const partial = count > 0 && !allOn;
            const labels = buildPermissionLabels(items);

            return (
              <div
                key={module}
                className={cn(
                  'grid gap-x-4 gap-y-2 px-4 py-2.5 md:grid-cols-[240px_minmax(0,1fr)]',
                  count > 0 && 'bg-muted/20'
                )}
              >
                <label className="flex cursor-pointer items-center gap-2.5 self-start pt-0.5">
                  <Checkbox
                    checked={allOn ? true : partial ? 'indeterminate' : false}
                    onCheckedChange={() => toggleGroup(ids)}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{module}</span>
                  <span
                    className={cn(
                      'inline-flex h-[18px] min-w-[34px] items-center justify-center border px-1 font-mono text-[10px] font-bold tabular-nums',
                      count > 0
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    {count}/{ids.length}
                  </span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {visible.map((permission) => {
                    const on = selected.has(permission.id);
                    return (
                      <div
                        key={permission.id}
                        className={cn(
                          'inline-flex h-7 items-stretch border text-xs transition-colors',
                          on
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted/60'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => togglePermission(permission.id)}
                          title={permission.description || permission.name}
                          className="px-2.5 font-mono text-[11px] font-medium"
                        >
                          {labels[permission.id]}
                        </button>
                        {onShowPermissionInfo && (
                          <button
                            type="button"
                            onClick={() => onShowPermissionInfo(permission)}
                            aria-label={`Detail ${permission.name}`}
                            className={cn(
                              'flex w-6 items-center justify-center border-l',
                              on ? 'border-white/20 hover:bg-white/10 dark:border-neutral-900/20' : 'border-border hover:bg-muted'
                            )}
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer aksi */}
      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {values.permission_ids.length} permission • {activeModuleCount} modul
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckSquare, Info, Layers3, Search, ShieldCheck } from "lucide-react";

type PermissionItem = {
  id: number;
  name: string;
  module?: string;
  category?: string;
  description?: string;
};

interface PermissionAssignmentPanelProps {
  groupedPermissions: Record<string, PermissionItem[]>;
  selectedPermissionIds: number[];
  onTogglePermission: (permissionId: number) => void;
  onReplaceSelection: (permissionIds: number[]) => void;
  onShowPermissionInfo?: (permission: PermissionItem) => void;
  className?: string;
}

export function PermissionAssignmentPanel({
  groupedPermissions,
  selectedPermissionIds,
  onTogglePermission,
  onReplaceSelection,
  onShowPermissionInfo,
  className,
}: PermissionAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);

  const moduleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return Object.entries(groupedPermissions)
      .map(([module, permissions]) => {
        const filteredPermissions = permissions.filter((permission) => {
          const matchesQuery = !query || [permission.name, permission.category, permission.description, module]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);

          const matchesSelection = !selectedOnly || selectedPermissionIds.includes(permission.id);
          return matchesQuery && matchesSelection;
        });

        return [module, filteredPermissions] as const;
      })
      .filter(([, permissions]) => permissions.length > 0)
      .sort(([left], [right]) => left.localeCompare(right));
  }, [groupedPermissions, search, selectedOnly, selectedPermissionIds]);

  const totalPermissions = useMemo(
    () => Object.values(groupedPermissions).reduce((total, permissions) => total + permissions.length, 0),
    [groupedPermissions]
  );

  const allPermissionIds = useMemo(
    () => Object.values(groupedPermissions).flatMap((permissions) => permissions.map((permission) => permission.id)),
    [groupedPermissions]
  );

  const visiblePermissionIds = useMemo(
    () => moduleEntries.flatMap(([, permissions]) => permissions.map((permission) => permission.id)),
    [moduleEntries]
  );

  const visibleSelectedCount = visiblePermissionIds.filter((permissionId) => selectedPermissionIds.includes(permissionId)).length;
  const selectedModules = useMemo(
    () => Object.entries(groupedPermissions)
      .filter(([, permissions]) => permissions.some((permission) => selectedPermissionIds.includes(permission.id)))
      .map(([module]) => module)
      .sort((left, right) => left.localeCompare(right)),
    [groupedPermissions, selectedPermissionIds]
  );

  const selectVisiblePermissions = () => {
    onReplaceSelection([...new Set([...selectedPermissionIds, ...visiblePermissionIds])]);
  };

  const clearVisiblePermissions = () => {
    onReplaceSelection(selectedPermissionIds.filter((permissionId) => !visiblePermissionIds.includes(permissionId)));
  };

  const selectAllPermissions = () => {
    onReplaceSelection(allPermissionIds);
  };

  const clearAllPermissions = () => {
    onReplaceSelection([]);
  };

  const toggleModulePermissions = (modulePermissions: PermissionItem[]) => {
    const modulePermissionIds = modulePermissions.map((permission) => permission.id);
    const allSelected = modulePermissionIds.every((permissionId) => selectedPermissionIds.includes(permissionId));

    if (allSelected) {
      onReplaceSelection(selectedPermissionIds.filter((permissionId) => !modulePermissionIds.includes(permissionId)));
      return;
    }

    onReplaceSelection([...new Set([...selectedPermissionIds, ...modulePermissionIds])]);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-border/70 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" /> Modul
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{Object.keys(groupedPermissions).length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Kelompok akses yang bisa diatur per area kerja.</p>
        </div>
        <div className="border border-border/70 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Total Permission
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalPermissions}</div>
          <p className="mt-1 text-xs text-muted-foreground">Hak akses tersedia dari seluruh modul yang sudah terdaftar.</p>
        </div>
        <div className="border border-border/70 bg-foreground px-4 py-3 text-background">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-background/70">
            <CheckSquare className="h-3.5 w-3.5" /> Dipilih
          </div>
          <div className="mt-2 text-2xl font-semibold">{selectedPermissionIds.length}</div>
          <p className="mt-1 text-xs text-background/80">Permission aktif untuk role ini saat disimpan.</p>
        </div>
      </div>

      <div className="space-y-4 border border-border/70 bg-background">
        <div className="border-b border-border/70 bg-muted/10 px-4 py-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari permission, kategori, deskripsi, atau modul..."
                className="w-full pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedOnly((current) => !current)}
              >
                {selectedOnly ? "Tampilkan Semua" : "Hanya Yang Dipilih"}
              </Button>
              <Badge variant="outline" className="h-9 rounded-none px-3 text-xs">
                {visibleSelectedCount}/{visiblePermissionIds.length || 0} terlihat
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={selectAllPermissions} disabled={allPermissionIds.length === 0 || selectedPermissionIds.length === allPermissionIds.length}>
                Pilih Semua
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAllPermissions} disabled={selectedPermissionIds.length === 0}>
                Kosongkan Semua
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectVisiblePermissions} disabled={visiblePermissionIds.length === 0}>
                Pilih Terlihat
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearVisiblePermissions} disabled={visibleSelectedCount === 0}>
                Bersihkan Terlihat
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modul Aktif</p>
              <p className="mt-1 text-xs text-muted-foreground">Modul yang sudah memiliki permission terpilih untuk role ini.</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-[70%] lg:justify-end">
              {selectedModules.length > 0 ? (
                selectedModules.map((module) => (
                  <Badge key={module} variant="secondary" className="rounded-none px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                    {module}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belum ada modul yang aktif.</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          {moduleEntries.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {moduleEntries.map(([module, modulePermissions]) => {
                const selectedCount = modulePermissions.filter((permission) => selectedPermissionIds.includes(permission.id)).length;
                const allSelected = modulePermissions.every((permission) => selectedPermissionIds.includes(permission.id));

                return (
                  <div key={module} className="min-w-0 border border-border/70 bg-background/95">
                    <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">{module}</h4>
                            <Badge variant="outline" className="rounded-none text-[11px]">
                              {selectedCount}/{modulePermissions.length}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Atur permission untuk modul ini tanpa pindah halaman.</p>
                        </div>

                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleModulePermissions(modulePermissions)}>
                          {allSelected ? "Kosongkan Modul" : "Pilih Modul"}
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-[32rem] overflow-y-auto p-3">
                      <div className="space-y-2 pb-2">
                        {modulePermissions.map((permission) => {
                          const isSelected = selectedPermissionIds.includes(permission.id);

                          return (
                            <div
                              key={permission.id}
                              className={cn(
                                "flex items-start gap-3 border px-3 py-3 transition-colors",
                                isSelected ? "border-foreground/30 bg-muted/30" : "border-border/70 bg-background hover:bg-muted/20"
                              )}
                            >
                              <Checkbox
                                id={`permission-${permission.id}`}
                                checked={isSelected}
                                onCheckedChange={() => onTogglePermission(permission.id)}
                                className="mt-1"
                              />

                              <div className="min-w-0 flex-1">
                                <label htmlFor={`permission-${permission.id}`} className="cursor-pointer text-sm font-medium leading-5 text-foreground">
                                  {permission.name}
                                </label>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {permission.category ? (
                                    <Badge variant="secondary" className="rounded-none text-[10px] uppercase tracking-[0.16em]">
                                      {permission.category}
                                    </Badge>
                                  ) : null}
                                  {isSelected ? (
                                    <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.16em]">
                                      dipilih
                                    </Badge>
                                  ) : null}
                                </div>
                                {permission.description ? (
                                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{permission.description}</p>
                                ) : null}
                              </div>

                              {onShowPermissionInfo ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onShowPermissionInfo(permission)}
                                  className="h-8 w-8 shrink-0 rounded-none"
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-border/70 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">Tidak ada permission yang cocok.</p>
              <p className="mt-2 text-xs text-muted-foreground">Ubah kata kunci pencarian atau nonaktifkan filter pilihan saja.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
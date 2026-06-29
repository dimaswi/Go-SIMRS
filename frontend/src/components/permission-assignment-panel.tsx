import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Info, Search } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  const allPermissionIds = useMemo(
    () => Object.values(groupedPermissions).flatMap((permissions) => permissions.map((permission) => permission.id)),
    [groupedPermissions]
  );

  const visiblePermissionIds = useMemo(
    () => moduleEntries.flatMap(([, permissions]) => permissions.map((permission) => permission.id)),
    [moduleEntries]
  );

  const visibleSelectedCount = visiblePermissionIds.filter((permissionId) => selectedPermissionIds.includes(permissionId)).length;

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
    <div className={cn("", className)}>
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
        </div>

        <div className="flex flex-col md:flex-row border-t border-border/70">
          {moduleEntries.length > 0 ? (
            <>
              {/* Sidebar (Vertical Tabs) */}
              <div className="w-full md:w-64 border-r border-border/70 bg-muted/10 shrink-0 h-[40rem] overflow-y-auto flex flex-col relative">
                <div className="p-3 border-b border-border/70 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Daftar Modul</p>
                </div>
                <div className="p-2 space-y-1">
                  {moduleEntries.map(([module, modulePermissions]) => {
                    const selectedCount = modulePermissions.filter((permission) => selectedPermissionIds.includes(permission.id)).length;
                    const isActive = module === (activeTab || moduleEntries[0]?.[0]);
                    return (
                      <button
                        key={module}
                        type="button"
                        onClick={() => setActiveTab(module)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between rounded-md",
                          isActive
                            ? "bg-foreground text-background"
                            : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        <span className="truncate mr-2">{module}</span>
                        {selectedCount > 0 && (
                          <Badge
                            variant={isActive ? "secondary" : "default"}
                            className={cn(
                              "shrink-0 h-5 px-1.5 text-[10px] rounded-full",
                              isActive ? "bg-background text-foreground hover:bg-background" : ""
                            )}
                          >
                            {selectedCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-w-0 bg-background h-[40rem] flex flex-col">
                {(() => {
                  const activeModuleEntry = moduleEntries.find(([m]) => m === (activeTab || moduleEntries[0]?.[0])) || moduleEntries[0];
                  if (!activeModuleEntry) return null;

                  const [module, modulePermissions] = activeModuleEntry;
                  const selectedCount = modulePermissions.filter((permission) => selectedPermissionIds.includes(permission.id)).length;
                  const allSelected = modulePermissions.every((permission) => selectedPermissionIds.includes(permission.id));

                  return (
                    <div className="flex flex-col h-full min-h-0">
                      <div className="border-b border-border/70 bg-muted/10 px-5 py-4 shrink-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold text-foreground">{module}</h4>
                              <Badge variant="outline" className="rounded-none text-[11px] bg-background">
                                {selectedCount}/{modulePermissions.length} Dipilih
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">Centang kotak untuk memberikan hak akses pada modul ini.</p>
                          </div>

                          <Button type="button" variant="outline" size="sm" onClick={() => toggleModulePermissions(modulePermissions)} className="bg-background">
                            {allSelected ? "Kosongkan Modul" : "Pilih Semua di Modul Ini"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5">
                        <div className="grid gap-3 xl:grid-cols-2">
                          {modulePermissions.map((permission) => {
                            const isSelected = selectedPermissionIds.includes(permission.id);

                            return (
                              <div
                                key={permission.id}
                                className={cn(
                                  "flex items-start gap-3 border px-4 py-3.5 transition-colors rounded-md",
                                  isSelected ? "border-foreground/30 bg-muted/30" : "border-border/70 bg-background hover:bg-muted/10"
                                )}
                              >
                                <Checkbox
                                  id={`permission-${permission.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => onTogglePermission(permission.id)}
                                  className="mt-1"
                                />

                                <div className="min-w-0 flex-1">
                                  <label htmlFor={`permission-${permission.id}`} className="cursor-pointer text-sm font-medium leading-5 text-foreground block">
                                    {permission.name}
                                  </label>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    {permission.category ? (
                                      <Badge variant="secondary" className="rounded-none text-[10px] uppercase tracking-[0.16em]">
                                        {permission.category}
                                      </Badge>
                                    ) : null}
                                    {isSelected ? (
                                      <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.16em] border-green-500 text-green-600 bg-green-50">
                                        Aktif
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {permission.description ? (
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{permission.description}</p>
                                  ) : null}
                                </div>

                                {onShowPermissionInfo ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onShowPermissionInfo(permission)}
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
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
                })()}
              </div>
            </>
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
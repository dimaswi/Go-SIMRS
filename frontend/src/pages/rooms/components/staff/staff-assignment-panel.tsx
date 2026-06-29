import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2 } from "lucide-react";
import type { RoomStaff, MasterData } from "@/lib/api";

interface StaffAssignmentPanelProps {
  masterData: Record<string, MasterData[]>;
  staff: RoomStaff[];
  hasPermission: boolean;
  onAdd?: () => void;
  onDelete?: (staffId: number) => void;
}

export function StaffAssignmentPanel({
  masterData,
  staff,
  hasPermission,
  onAdd,
  onDelete,
}: StaffAssignmentPanelProps) {
  const [assignedSearch, setAssignedSearch] = useState("");

  const getRoleTypeName = (code: string) => {
    const role = masterData.room_staff_role?.find((item) => item.code === code);
    return role?.name || code;
  };

  const filteredAssignedStaff = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    if (!query) return staff;

    return staff.filter((item) =>
      [
        item.employee?.nama_lengkap,
        item.employee?.nip,
        item.employee?.tipe_karyawan,
        getRoleTypeName(item.role_type),
        item.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [assignedSearch, staff, masterData]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <div className="border-b border-border/70 bg-muted/20 p-3 flex justify-between">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={assignedSearch}
              onChange={(event) => setAssignedSearch(event.target.value)}
              placeholder="Cari staff..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {hasPermission && onAdd && (
              <Button onClick={onAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Staff
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/50 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pegawai</th>
                <th className="px-4 py-3 font-medium">NIP</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Peran</th>
                <th className="px-4 py-3 font-medium">Catatan</th>
                {hasPermission && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-background">
              {filteredAssignedStaff.length === 0 ? (
                <tr>
                  <td colSpan={hasPermission ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada staff yang ditugaskan ke ruangan ini.
                  </td>
                </tr>
              ) : (
                filteredAssignedStaff.map((item) => (
                  <tr key={item.id} className="align-middle hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.employee?.nama_lengkap || 'Unknown'}</span>
                        {item.is_primary ? <Badge variant="secondary" className="text-[10px] px-1.5 font-normal">Utama</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{item.employee?.nip || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.employee?.tipe_karyawan || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] font-normal">{getRoleTypeName(item.role_type)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.notes || '-'}</td>
                    {hasPermission && (
                      <td className="px-4 py-3 text-right">
                        {onDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

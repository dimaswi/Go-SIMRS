import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import {
  calculateTotalTariff,
  getProcedureTypeLabel,
} from "@/lib/api/procedures";
import type { RoomProcedure } from "@/lib/api/procedures";

interface ProcedureAssignmentPanelProps {
  roomId: number;
  roomProcedures: RoomProcedure[];
  hasPermission: boolean;
  onAdd?: () => void;
  onEdit?: (rp: RoomProcedure) => void;
  onDelete?: (rpId: number) => void;
  onRefresh?: () => Promise<void>;
}

export function ProcedureAssignmentPanel({
  roomProcedures,
  hasPermission,
  onAdd,
  onEdit,
  onDelete,
}: ProcedureAssignmentPanelProps) {
  const [assignedSearch, setAssignedSearch] = useState("");

  const filteredAssignedProcedures = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    if (!query) return roomProcedures;

    return roomProcedures.filter((item) =>
      [
        item.procedure?.name,
        item.procedure?.code,
        item.procedure?.procedure_type ? getProcedureTypeLabel(item.procedure.procedure_type) : '',
        item.is_available ? 'tersedia' : 'tidak tersedia',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [assignedSearch, roomProcedures]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <div className="border-b border-border/70 bg-muted/20 p-3 flex justify-between">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={assignedSearch}
              onChange={(event) => setAssignedSearch(event.target.value)}
              placeholder="Cari tindakan..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {hasPermission && onAdd && (
              <Button onClick={onAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Tindakan
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/50 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Tindakan</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Tarif</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Maks/Hari</th>
                {hasPermission && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-background">
              {filteredAssignedProcedures.length === 0 ? (
                <tr>
                  <td colSpan={hasPermission ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada tindakan yang ditugaskan ke ruangan ini.
                  </td>
                </tr>
              ) : (
                filteredAssignedProcedures.map((item) => {
                  const tariff = item.procedure?.tariffs?.[0];
                  const total = tariff ? calculateTotalTariff(tariff) : 0;

                  return (
                    <tr key={item.id} className="align-middle hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.procedure?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{item.procedure?.code || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {item.procedure?.procedure_type ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {getProcedureTypeLabel(item.procedure.procedure_type)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-primary">
                        {tariff ? formatCurrency(total) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.is_available ? 'default' : 'secondary'} className="text-[10px] font-normal">
                          {item.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.requires_booking ? (
                          <Badge variant="outline" className="text-[10px] font-normal">Ya</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Tidak</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {item.max_per_day > 0 ? item.max_per_day : 'Tanpa batas'}
                      </td>
                      {hasPermission && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {onEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

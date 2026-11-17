import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const columns = useMemo<ColumnDef<RoomProcedure>[]>(() => [
    {
      id: "procedure",
      accessorFn: (row) => `${row.procedure?.name || ""} ${row.procedure?.code || ""}`,
      header: "Tindakan",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{item.procedure?.name || "Unknown"}</span>
              {item.is_mandatory && (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">Wajib</Badge>
              )}
              {item.is_prescription_fee && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
                  Jasa Resep
                </Badge>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">{item.procedure?.code || "-"}</div>
          </div>
        );
      },
    },
    {
      id: "type",
      accessorFn: (row) => (row.procedure?.procedure_type ? getProcedureTypeLabel(row.procedure.procedure_type) : "-"),
      header: "Tipe",
      cell: ({ row }) =>
        row.original.procedure?.procedure_type ? (
          <Badge variant="outline" className="h-5 text-[10px] font-normal">
            {getProcedureTypeLabel(row.original.procedure.procedure_type)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      id: "tariff",
      header: "Tarif",
      cell: ({ row }) => {
        const tariff = row.original.procedure?.tariffs?.[0];
        const total = tariff ? calculateTotalTariff(tariff) : 0;
        return <span className="text-xs font-medium text-primary">{tariff ? formatCurrency(total) : "-"}</span>;
      },
    },
    {
      accessorKey: "is_available",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_available ? "default" : "secondary"} className="h-5 text-[10px] font-normal">
          {row.original.is_available ? "Tersedia" : "Tidak Tersedia"}
        </Badge>
      ),
    },
    {
      accessorKey: "requires_booking",
      header: "Booking",
      cell: ({ row }) =>
        row.original.requires_booking ? (
          <Badge variant="outline" className="h-5 text-[10px] font-normal">Ya</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Tidak</span>
        ),
    },
    {
      accessorKey: "max_per_day",
      header: "Maks/Hari",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.max_per_day > 0 ? row.original.max_per_day : "Tanpa batas"}
        </span>
      ),
    },
    ...(hasPermission && (onEdit || onDelete)
      ? [
          {
            id: "actions",
            header: () => <div className="text-right">Aksi</div>,
            cell: ({ row }: { row: { original: RoomProcedure } }) => (
              <div className="flex items-center justify-end gap-1">
                {onEdit && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row.original)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(row.original.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ),
          } as ColumnDef<RoomProcedure>,
        ]
      : []),
  ], [hasPermission, onEdit, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={roomProcedures}
      searchPlaceholder="Cari tindakan..."
      hideRowCount
      toolbarRight={
        hasPermission && onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Tindakan
          </Button>
        ) : undefined
      }
    />
  );
}

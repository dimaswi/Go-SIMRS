import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { medicineTypeLabels, type RoomMedicine } from "@/lib/api/medicines";

interface MedicineAssignmentPanelProps {
  roomId: number;
  roomMedicines: RoomMedicine[];
  onRefresh: () => void;
  hasPermission: boolean;
  onAdd?: () => void;
  onEdit?: (rm: RoomMedicine) => void;
  onDelete?: (rmId: number) => void;
}

export function MedicineAssignmentPanel({
  roomMedicines,
  hasPermission,
  onAdd,
  onEdit,
  onDelete,
}: MedicineAssignmentPanelProps) {
  const columns = useMemo<ColumnDef<RoomMedicine>[]>(() => [
    {
      id: "medicine",
      accessorFn: (row) => `${row.medicine?.name || ""} ${row.medicine?.code || ""}`,
      header: "Obat",
      cell: ({ row }) => (
        <div className="text-xs">
          <div className="font-medium">{row.original.medicine?.name || "Unknown"}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{row.original.medicine?.code || "-"}</div>
        </div>
      ),
    },
    {
      id: "type",
      accessorFn: (row) => (row.medicine?.type ? medicineTypeLabels[row.medicine.type] || row.medicine.type : "-"),
      header: "Tipe",
      cell: ({ row }) =>
        row.original.medicine?.type ? (
          <Badge variant="outline" className="h-5 text-[10px] font-normal">
            {medicineTypeLabels[row.original.medicine.type] || row.original.medicine.type}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "quantity",
      header: "Stok",
      cell: ({ row }) => {
        const item = row.original;
        const isLowStock = item.quantity <= item.min_quantity;
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={isLowStock ? "font-semibold text-yellow-600" : "font-semibold"}>{item.quantity}</span>
            {isLowStock ? <Badge variant="outline" className="h-4 text-[10px] font-normal">Rendah</Badge> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "min_quantity",
      header: "Min.",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.min_quantity}</span>,
    },
    {
      id: "selling_price",
      accessorFn: (row) => row.medicine?.selling_price || 0,
      header: "Harga Jual",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-primary">
          {row.original.medicine?.selling_price
            ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(row.original.medicine.selling_price)
            : "-"}
        </span>
      ),
    },
    ...(hasPermission && (onEdit || onDelete)
      ? [
          {
            id: "actions",
            header: () => <div className="text-right">Aksi</div>,
            cell: ({ row }: { row: { original: RoomMedicine } }) => (
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
          } as ColumnDef<RoomMedicine>,
        ]
      : []),
  ], [hasPermission, onEdit, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={roomMedicines}
      searchPlaceholder="Cari obat..."
      hideRowCount
      toolbarRight={
        hasPermission && onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Obat Manual
          </Button>
        ) : undefined
      }
    />
  );
}

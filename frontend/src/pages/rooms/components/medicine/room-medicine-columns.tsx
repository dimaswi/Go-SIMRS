import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  type RoomMedicine,
  type MedicineCategory,
  type MedicineForm,
  medicineCategoryLabels,
  medicineFormLabels,
} from "@/lib/api/medicines";
import { cn } from "@/lib/utils";

interface CreateRoomMedicineColumnsOptions {
  onEdit: (roomMedicine: RoomMedicine) => void;
  onDelete: (roomMedicineId: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

const getCategoryBadgeColor = (category: MedicineCategory): string => {
  const colorMap: Record<MedicineCategory, string> = {
    generic: "bg-blue-100 text-blue-800",
    patent: "bg-purple-100 text-purple-800",
    herbal: "bg-green-100 text-green-800",
    traditional: "bg-amber-100 text-amber-800",
    biological: "bg-pink-100 text-pink-800",
  };
  return colorMap[category] || "";
};

const getFormBadgeColor = (form: MedicineForm): string => {
  const colorMap: Record<MedicineForm, string> = {
    tablet: "bg-slate-100 text-slate-800",
    capsule: "bg-orange-100 text-orange-800",
    syrup: "bg-cyan-100 text-cyan-800",
    injection: "bg-red-100 text-red-800",
    cream: "bg-yellow-100 text-yellow-800",
    ointment: "bg-lime-100 text-lime-800",
    drops: "bg-sky-100 text-sky-800",
    powder: "bg-teal-100 text-teal-800",
    infusion: "bg-rose-100 text-rose-800",
    suppository: "bg-violet-100 text-violet-800",
    inhaler: "bg-indigo-100 text-indigo-800",
    patch: "bg-fuchsia-100 text-fuchsia-800",
    other: "bg-gray-100 text-gray-800",
  };
  return colorMap[form] || "";
};

export function createRoomMedicineColumns({
  onEdit,
  onDelete,
  hasEditPermission,
  hasDeletePermission,
}: CreateRoomMedicineColumnsOptions): ColumnDef<RoomMedicine>[] {
  return [
    {
      accessorKey: "medicine.code",
      header: "Kode",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.medicine?.code || "-"}
        </span>
      ),
    },
    {
      accessorKey: "medicine.name",
      header: "Nama Obat",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.medicine?.name || "-"}</div>
          {row.original.medicine?.manufacturer && (
            <div className="text-xs text-muted-foreground">
              {row.original.medicine.manufacturer}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "medicine.category",
      header: "Kategori",
      cell: ({ row }) => {
        const category = row.original.medicine?.category;
        if (!category) return "-";
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", getCategoryBadgeColor(category))}
          >
            {medicineCategoryLabels[category]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "medicine.form",
      header: "Bentuk",
      cell: ({ row }) => {
        const form = row.original.medicine?.form;
        if (!form) return "-";
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", getFormBadgeColor(form))}
          >
            {medicineFormLabels[form]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Jumlah",
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-semibold">{row.original.quantity}</span>
          {row.original.medicine?.unit && (
            <span className="text-muted-foreground ml-1 text-sm">
              {row.original.medicine.unit}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "min_quantity",
      header: "Min. Stok",
      cell: ({ row }) => {
        const min = row.original.min_quantity;
        const current = row.original.quantity;
        const isLow = min > 0 && current < min;
        return (
          <div className="text-center">
            {min > 0 ? (
              <span className={isLow ? "text-destructive font-medium" : ""}>
                {min}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const min = row.original.min_quantity;
        const current = row.original.quantity;
        if (min > 0 && current < min) {
          return (
            <Badge variant="destructive" className="text-xs">
              Stok Rendah
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            Normal
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center gap-1">
          {hasEditPermission && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasDeletePermission && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}

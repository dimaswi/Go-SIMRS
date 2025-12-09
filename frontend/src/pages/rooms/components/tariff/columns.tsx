import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import type { RoomTariff, MasterData } from "@/lib/api";

interface ColumnOptions {
  onEdit: (tariff: RoomTariff) => void;
  onDelete: (id: number) => void;
  hasEditPermission: boolean;
  patientClasses: MasterData[];
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const calculateTotal = (tariff: RoomTariff): number => {
  return (
    tariff.akomodasi +
    tariff.makan +
    tariff.perawatan +
    tariff.administrasi +
    tariff.lainnya
  );
};

export function createRoomTariffColumns(
  options: ColumnOptions
): ColumnDef<RoomTariff>[] {
  const { onEdit, onDelete, hasEditPermission, patientClasses } = options;

  const getPatientClassName = (code: string): string => {
    const found = patientClasses.find((c) => c.code === code);
    return found?.name || code;
  };

  return [
    {
      accessorKey: "patient_class",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kelas Pasien
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {getPatientClassName(row.getValue("patient_class"))}
        </span>
      ),
    },
    {
      accessorKey: "akomodasi",
      header: () => <div className="text-right">Akomodasi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.getValue("akomodasi"))}
        </div>
      ),
    },
    {
      accessorKey: "makan",
      header: () => <div className="text-right">Makan</div>,
      cell: ({ row }) => (
        <div className="text-right">{formatCurrency(row.getValue("makan"))}</div>
      ),
    },
    {
      accessorKey: "perawatan",
      header: () => <div className="text-right">Perawatan</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.getValue("perawatan"))}
        </div>
      ),
    },
    {
      accessorKey: "administrasi",
      header: () => <div className="text-right">Administrasi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.getValue("administrasi"))}
        </div>
      ),
    },
    {
      accessorKey: "lainnya",
      header: () => <div className="text-right">Lainnya</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.getValue("lainnya"))}
        </div>
      ),
    },
    {
      id: "total",
      header: () => <div className="text-right">Total/Hari</div>,
      cell: ({ row }) => (
        <div className="text-right font-semibold text-primary">
          {formatCurrency(calculateTotal(row.original))}
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
            {row.getValue("is_active") ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => {
        if (!hasEditPermission) return null;

        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
}

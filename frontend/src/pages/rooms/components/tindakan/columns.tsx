import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Trash2 } from "lucide-react";
import type { RoomProcedure } from "@/lib/api/procedures";
import { getProcedureTypeLabel, calculateTotalTariff } from "@/lib/api/procedures";

interface ColumnOptions {
  onRemove: (id: number) => void;
  hasPermission: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

export function createProcedureColumns(
  options: ColumnOptions
): ColumnDef<RoomProcedure>[] {
  const { onRemove, hasPermission } = options;

  return [
    {
      accessorKey: "procedure.code",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kode
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium text-sm">
          {row.original.procedure?.code || "-"}
        </span>
      ),
    },
    {
      accessorKey: "procedure.name",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Nama Tindakan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.procedure?.name || "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "procedure.procedure_type",
      header: "Tipe",
      cell: ({ row }) => {
        const type = row.original.procedure?.procedure_type;
        if (!type) return <span className="text-muted-foreground">-</span>;
        
        return (
          <Badge variant="outline" className="text-xs">
            {getProcedureTypeLabel(type)}
          </Badge>
        );
      },
    },
    {
      id: "tariff",
      header: () => <div className="text-right">Tarif Total</div>,
      cell: ({ row }) => {
        const procedure = row.original.procedure;
        if (!procedure || !procedure.tariffs || procedure.tariffs.length === 0) {
          return <div className="text-right text-muted-foreground">-</div>;
        }
        
        const total = calculateTotalTariff(procedure.tariffs[0]);
        return (
          <div className="text-right font-medium text-primary">
            {formatCurrency(total)}
          </div>
        );
      },
    },
    {
      accessorKey: "is_available",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant={row.getValue("is_available") ? "default" : "secondary"}>
            {row.getValue("is_available") ? "Tersedia" : "Tidak Tersedia"}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "requires_booking",
      header: () => <div className="text-center">Perlu Booking</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant={row.getValue("requires_booking") ? "outline" : "secondary"}>
            {row.getValue("requires_booking") ? "Ya" : "Tidak"}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "max_per_day",
      header: () => <div className="text-center">Maks/Hari</div>,
      cell: ({ row }) => {
        const max = row.getValue("max_per_day") as number;
        return (
          <div className="text-center text-sm">
            {max > 0 ? max : "Unlimited"}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => {
        if (!hasPermission) return null;

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
}

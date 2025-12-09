import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Procedure } from "@/lib/api/procedures";
import { Loader2, PlusCircle } from "lucide-react";
import { getProcedureTypeLabel, calculateTotalTariff } from "@/lib/api/procedures";

interface CreateAvailableProcedureColumnsProps {
  onAdd: (procedureId: number) => void;
  hasPermission: boolean;
  addingId: number | null;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

export const createAvailableProcedureColumns = ({
  onAdd,
  hasPermission,
  addingId,
}: CreateAvailableProcedureColumnsProps): ColumnDef<Procedure>[] => [
  {
    accessorKey: "code",
    header: "Kode",
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.code}</div>;
    },
  },
  {
    accessorKey: "name",
    header: "Nama Tindakan",
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.name}</div>;
    },
  },
  {
    accessorKey: "procedure_type",
    header: "Tipe",
    cell: ({ row }) => {
      const type = row.original.procedure_type;
      return (
        <Badge variant="outline" className="text-xs">
          {getProcedureTypeLabel(type)}
        </Badge>
      );
    },
  },
  {
    id: "tariff",
    header: "Tarif",
    cell: ({ row }) => {
      const procedure = row.original;
      const tariff = procedure.tariffs?.[0];
      const total = tariff ? calculateTotalTariff(tariff) : 0;
      return <div className="text-sm">{formatCurrency(total)}</div>;
    },
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const procedure = row.original;
      
      if (!hasPermission) return null;

      return (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAdd(procedure.id)}
          disabled={addingId === procedure.id}
          className="h-8"
        >
          {addingId === procedure.id ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menambahkan...
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4 text-green-500" />
            </>
          )}
        </Button>
      );
    },
  },
];

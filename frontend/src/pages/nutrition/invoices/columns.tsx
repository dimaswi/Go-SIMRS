import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye, Pencil, Trash2 } from "lucide-react";
import type { NutritionIngredientInvoice } from "@/lib/api/nutrition";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
};

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export function createNutritionInvoiceColumns(options: ColumnOptions): ColumnDef<NutritionIngredientInvoice>[] {
  const { onView, onEdit, onDelete } = options;

  return [
    {
      accessorKey: "code",
      header: "Kode Internal",
      cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: "invoice_number",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0 hover:bg-transparent">
          No. Faktur
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.invoice_number}</div>
          <div className="text-xs text-muted-foreground">{formatDate(row.original.invoice_date)}</div>
        </div>
      ),
    },
    {
      accessorKey: "supplier_name",
      header: "Supplier",
      cell: ({ row }) => <span>{row.original.supplier_name || "-"}</span>,
    },
    {
      accessorKey: "items",
      header: "Item",
      cell: ({ row }) => <span>{row.original.items?.length || 0} bahan</span>,
    },
    {
      accessorKey: "total_amount",
      sortDescFirst: true,
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0 hover:bg-transparent">
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono font-medium">{formatCurrency(row.original.total_amount)}</span>,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              title="Lihat Detail"
              onClick={() => onView(item.id)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
              title="Edit"
              onClick={() => onEdit(item.id)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
              title="Hapus"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];
}

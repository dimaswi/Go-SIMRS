import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import type { RoomMedicine } from "@/lib/api/medicines";
import { medicineTypeLabels } from "@/lib/api/medicines";
import { cn } from "@/lib/utils";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price);
};

const getTypeBadgeColor = (type: string) => {
  const colors: Record<string, string> = {
    ethical: "bg-blue-100 text-blue-800",
    generic: "bg-green-100 text-green-800",
    patent: "bg-purple-100 text-purple-800",
    otc: "bg-yellow-100 text-yellow-800",
    herbal: "bg-emerald-100 text-emerald-800",
    supplement: "bg-orange-100 text-orange-800",
    cosmetic: "bg-pink-100 text-pink-800",
    medical_device: "bg-cyan-100 text-cyan-800",
    consumable: "bg-gray-100 text-gray-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

export function createMedicineColumns(): ColumnDef<RoomMedicine>[] {
  return [
    {
      accessorKey: "medicine.code",
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
          {row.original.medicine?.code || "-"}
        </span>
      ),
    },
    {
      accessorKey: "medicine.name",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Nama Obat
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.medicine?.name || "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "medicine.type",
      header: "Tipe",
      cell: ({ row }) => {
        const type = row.original.medicine?.type;
        if (!type) return <span className="text-muted-foreground">-</span>;
        
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", getTypeBadgeColor(type))}
          >
            {medicineTypeLabels[type] || type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Stok
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        const minQuantity = row.original.min_quantity;
        const isLowStock = quantity <= minQuantity;

        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-semibold",
                isLowStock ? "text-yellow-600" : "text-foreground"
              )}
            >
              {quantity}
            </span>
            {isLowStock && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-[10px]">
                Rendah
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "min_quantity",
      header: () => <div className="text-right">Min. Stok</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {row.getValue("min_quantity")}
        </div>
      ),
    },
    {
      accessorKey: "medicine.selling_price",
      header: () => <div className="text-right">Harga Jual</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm">
          {row.original.medicine?.selling_price
            ? formatPrice(row.original.medicine.selling_price)
            : "-"}
        </div>
      ),
    },
  ];
}

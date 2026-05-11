import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { 
  Medicine, 
  MedicineCategory,
  MedicineType,
  MedicineForm
} from "@/lib/api/medicines";

interface ColumnOptions {
  onTrace: (id: number) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasViewPermission: boolean;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

const categoryColors: Record<MedicineCategory, string> = {
  generic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  patent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  herbal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  traditional: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  biological: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

const categoryLabels: Record<MedicineCategory, string> = {
  generic: 'Generik',
  patent: 'Paten',
  herbal: 'Herbal',
  traditional: 'Tradisional',
  biological: 'Biologis',
};

const typeColors: Record<MedicineType, string> = {
  otc: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  limited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  narcotic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  psychotrope: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

const typeLabels: Record<MedicineType, string> = {
  otc: 'Bebas',
  limited: 'Bebas Terbatas',
  hard: 'Keras',
  narcotic: 'Narkotika',
  psychotrope: 'Psikotropika',
};

const formLabels: Record<MedicineForm, string> = {
  tablet: 'Tablet',
  capsule: 'Kapsul',
  syrup: 'Sirup',
  injection: 'Injeksi',
  cream: 'Krim',
  ointment: 'Salep',
  drops: 'Tetes',
  powder: 'Serbuk',
  infusion: 'Infus',
  suppository: 'Supositoria',
  inhaler: 'Inhaler',
  patch: 'Patch',
  other: 'Lainnya',
};

export function createMedicineColumns(options: ColumnOptions): ColumnDef<Medicine>[] {
  const { onTrace, onView, onEdit, onDelete, hasViewPermission, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "code",
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
        <span className="font-mono font-medium">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
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
        hasViewPermission ? (
          <button
            onClick={() => onTrace(row.original.id)}
            className="text-left text-primary font-medium hover:underline"
          >
            {row.getValue("name")}
          </button>
        ) : (
          <span className="font-medium">{row.getValue("name")}</span>
        )
      ),
    },
    {
      accessorKey: "generic_name",
      header: "Nama Generik",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("generic_name") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "dpho_kode_obat",
      header: "Mapping BPJS",
      cell: ({ row }) => {
        const kodeDPHO = row.original.dpho_kode_obat;
        const namaDPHO = row.original.dpho_nama_obat;

        if (!kodeDPHO) {
          return <Badge variant="secondary">Belum dipetakan</Badge>;
        }

        return (
          <div className="space-y-1">
            <Badge variant="outline" className="font-mono">
              {kodeDPHO}
            </Badge>
            <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={namaDPHO || kodeDPHO}>
              {namaDPHO || "Nama DPHO tidak tersedia"}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kategori
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.getValue("category") as MedicineCategory;
        return (
          <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>
            {categoryLabels[category] || category}
          </Badge>
        );
      },
    },
    {
      accessorKey: "type",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Golongan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const type = row.getValue("type") as MedicineType;
        return (
          <Badge variant="outline" className={typeColors[type] || 'bg-gray-100 text-gray-800'}>
            {typeLabels[type] || type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "form",
      header: "Bentuk",
      cell: ({ row }) => {
        const form = row.getValue("form") as MedicineForm;
        return formLabels[form] || form;
      },
    },
    {
      accessorKey: "strength",
      header: "Kekuatan",
      cell: ({ row }) => row.getValue("strength") || "-",
    },
    {
      accessorKey: "current_stock",
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
        const stock = row.original.current_stock;
        const minStock = row.original.min_stock;
        const unit = row.original.unit;
        const isLow = stock <= minStock;
        return (
          <div className="flex items-center gap-2">
            <span className={isLow ? "text-red-600 font-medium" : ""}>
              {stock} {unit}
            </span>
            {isLow && <Badge variant="destructive" className="text-xs">Low</Badge>}
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
          {row.getValue("is_active") ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const medicine = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasViewPermission && (
                <DropdownMenuItem onClick={() => onView(medicine.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Detail
                </DropdownMenuItem>
              )}
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(medicine.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(medicine.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

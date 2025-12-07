import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { Procedure } from "@/lib/api/procedures";
import { getProcedureGroupLabel, getServiceTypeLabel, getProcedureTypeLabel } from "@/lib/api/procedures";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasViewPermission: boolean;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createProcedureColumns(options: ColumnOptions): ColumnDef<Procedure>[] {
  const { onView, onEdit, onDelete, hasViewPermission, hasEditPermission, hasDeletePermission } = options;

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
          Nama Tindakan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original.id)}
          className="text-left hover:underline text-primary font-medium"
        >
          <div>
            <div>{row.getValue("name")}</div>
            {row.original.icd9cm_code && (
              <div className="text-xs text-muted-foreground font-normal">
                ICD-9-CM: {row.original.icd9cm_code}
              </div>
            )}
          </div>
        </button>
      ),
    },
    {
      accessorKey: "inacbg_code",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          INA-CBG
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const code = row.getValue("inacbg_code") as string;
        return code ? (
          <span className="font-mono text-sm">{code}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "procedure_type",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Jenis
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const type = row.getValue("procedure_type") as string;
        const variants: Record<string, "default" | "secondary" | "outline"> = {
          'medical': 'default',
          'radiology': 'secondary',
          'laboratory': 'outline',
        };
        return type ? (
          <Badge variant={variants[type] || "default"}>{getProcedureTypeLabel(type as any)}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "procedure_group",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kelompok
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const group = row.getValue("procedure_group") as string;
        return group ? (
          <Badge variant="outline">{getProcedureGroupLabel(group)}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "service_type",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Layanan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const type = row.getValue("service_type") as string;
        return type ? (
          <Badge variant="secondary">{getServiceTypeLabel(type)}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "is_active",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const procedure = row.original;

        if (!hasViewPermission && !hasEditPermission && !hasDeletePermission) {
          return null;
        }

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
                <DropdownMenuItem onClick={() => onView(procedure.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Lihat Detail
                </DropdownMenuItem>
              )}
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(procedure.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <DropdownMenuItem
                  onClick={() => onDelete(procedure.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

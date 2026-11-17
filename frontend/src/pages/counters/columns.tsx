import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Counter } from "@/lib/api/counters";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";

interface ColumnOptions {
  onDelete: (id: number) => void;
}

export function createCounterColumns(options: ColumnOptions): ColumnDef<Counter>[] {
  return [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <span className="font-mono font-semibold">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Loket",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Deskripsi",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description || "-"}</span>
      ),
    },
    {
      accessorKey: "location",
      header: "Lokasi",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.location || "-"}</span>
      ),
    },
    {
      accessorKey: "display_order",
      header: "Urutan",
      cell: ({ row }) => {
        const order = row.original.display_order;
        return <span className="font-medium">{order ?? 0}</span>;
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Dibuat",
      cell: ({ row }) => {
        if (!row.original.created_at) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        const date = new Date(row.original.created_at);
        if (isNaN(date.getTime())) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        return (
          <span className="text-sm text-muted-foreground">
            {format(date, "dd MMM yyyy", { locale: localeId })}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const counter = row.original;
        const { hasPermission } = usePermission();
        const hasViewPermission = hasPermission("counters.view");
        const hasUpdatePermission = hasPermission("counters.update");
        const hasDeletePermission = hasPermission("counters.delete");

        return (
          <div className="flex items-center gap-1.5">
            {hasViewPermission && (
              <Link to={`/counters/${counter.id}`}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
                >
                  <Eye className="size-3.5" />
                </Button>
              </Link>
            )}
            {hasUpdatePermission && (
              <Link to={`/counters/${counter.id}/edit`}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </Link>
            )}
            {hasDeletePermission && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => options.onDelete(counter.id)}
                className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}

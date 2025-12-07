import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, BedDouble, Calendar, ArrowUpDown, ListOrdered } from "lucide-react";
import type { Room } from "@/lib/api";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onViewQueue: (id: number) => void;
  hasViewPermission: boolean;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  getMasterDataName: (category: string, code: string) => string;
}

export function createRoomColumns(options: ColumnOptions): ColumnDef<Room>[] {
  const { onView, onEdit, onDelete, onViewQueue, hasViewPermission, hasEditPermission, hasDeletePermission, getMasterDataName } = options;

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
        <span className="font-medium">{row.getValue("code")}</span>
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
          Nama Ruangan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original.id)}
          className="text-left hover:underline text-primary font-medium"
        >
          {row.getValue("name")}
        </button>
      ),
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
          Jenis Layanan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const serviceType = row.original.service_type;
        return (
          <Badge variant="secondary">
            {getMasterDataName('service_type', serviceType)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "room_type",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Tipe Ruangan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => getMasterDataName('room_type', row.getValue("room_type")),
    },
    {
      accessorKey: "room_class",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kelas
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const roomClass = row.original.room_class;
        if (!roomClass) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant="outline">
            {getMasterDataName('room_class', roomClass)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "units",
      header: "Kamar / Bed",
      cell: ({ row }) => {
        if (!row.original.has_bed) {
          return <span className="text-muted-foreground">-</span>;
        }
        const units = row.original.units || [];
        const totalBeds = row.original.total_beds || 0;
        const availableBeds = row.original.available_beds || 0;
        return (
          <div className="flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            <span>{units.length} kamar / {availableBeds}/{totalBeds} bed</span>
          </div>
        );
      },
    },
    {
      accessorKey: "features",
      header: "Fitur",
      cell: ({ row }) => {
        const hasBed = row.original.has_bed;
        const hasSchedule = row.original.has_schedule;
        return (
          <div className="flex items-center gap-1">
            {hasBed && (
              <Badge variant="outline" className="text-xs">
                <BedDouble className="h-3 w-3 mr-1" />
                Bed
              </Badge>
            )}
            {hasSchedule && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Jadwal
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "pic_employee",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Penanggung Jawab
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const pic = row.original.pic_employee;
        if (!pic) return <span className="text-muted-foreground">-</span>;
        return <span>{pic.nama_lengkap}</span>;
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
        const isActive = row.getValue("is_active");
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Aktif" : "Tidak Aktif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const room = row.original;

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
                <DropdownMenuItem onClick={() => onView(room.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Lihat
                </DropdownMenuItem>
              )}
              {hasViewPermission && (
                <DropdownMenuItem onClick={() => onViewQueue(room.id)}>
                  <ListOrdered className="mr-2 h-4 w-4" />
                  Kelola Antrian
                </DropdownMenuItem>
              )}
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(room.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <DropdownMenuItem
                  onClick={() => onDelete(room.id)}
                  className="text-red-600"
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

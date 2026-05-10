import type { ColumnDef } from "@tanstack/react-table";
import type { Patient } from "@/lib/api";
import { formatPatientName } from "@/lib/print-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, User, ArrowUpDown, CheckCircle, XCircle, Smartphone, Mars, Venus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, differenceInYears, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface PatientColumnsProps {
  onView: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  canEdit: boolean;
  canDelete: boolean;
}

// Calculate age from date of birth
const calculateAge = (birthDate: string | undefined) => {
  if (!birthDate) return '-';
  try {
    const dob = parseISO(birthDate);
    const age = differenceInYears(new Date(), dob);
    return `${age} tahun`;
  } catch {
    return '-';
  }
};

// Format date for display
const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: id });
  } catch {
    return '-';
  }
};

// Get status badge variant
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Aktif':
      return 'default';
    case 'Tidak Aktif':
      return 'secondary';
    case 'Meninggal':
      return 'destructive';
    default:
      return 'outline';
  }
};

export const createPatientColumns = ({
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: PatientColumnsProps): ColumnDef<Patient>[] => [
  {
    accessorKey: "no_rm",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        No. RM
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium">
          {row.original.no_rm}
        </span>
        {row.original.registration_source === 'mjkn' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">
                  <Smartphone className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Pasien terdaftar dari Mobile JKN</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    ),
  },
  {
    accessorKey: "nama_lengkap",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Nama Pasien
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row, table }) => {
      const meta = table.options.meta as { onView?: (patient: Patient) => void };
      return (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            {row.original.jenis_kelamin === 'L' ? <Mars className="text-blue-300"/> : <Venus className="text-pink-300"/>}
          </div>
          <div>
            <button
              type="button"
              onClick={() => meta?.onView?.(row.original)}
              className="font-medium text-left hover:text-primary hover:underline cursor-pointer"
            >
              {formatPatientName(row.original.nama_lengkap, row.original.jenis_kelamin, row.original.status_perkawinan, row.original.tanggal_lahir)}
              <span>
                &nbsp;&nbsp;{row.original.status === "Aktif" ? <CheckCircle className="inline-block h-3 w-3 text-green-500" /> : <XCircle className="inline-block h-3 w-3 text-red-500" />}
              </span>
            </button>
            <p className="text-xs text-muted-foreground">
              {row.original.nik || 'Tidak ada data NIK'}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "tanggal_lahir",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Umur
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{calculateAge(row.original.tanggal_lahir)}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.tempat_lahir}, {formatDate(row.original.tanggal_lahir)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "no_hp",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        No. HP
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.original.no_hp || '-'}</span>
    ),
  },
  {
    accessorKey: "alamat_domisili",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Alamat
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const alamat = row.original.alamat_domisili || row.original.alamat_ktp || '-';
      const kelurahan = row.original.kelurahan_domisili || row.original.kelurahan_ktp || '';
      const kecamatan = row.original.kecamatan_domisili || row.original.kecamatan_ktp || '';
      
      return (
        <div className="max-w-[200px]">
          <p className="text-sm truncate" title={alamat}>{alamat}</p>
          {(kelurahan || kecamatan) && (
            <p className="text-xs text-muted-foreground truncate" title={`${kelurahan}, ${kecamatan}`}>
              {[kelurahan, kecamatan].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "tanggal_kunjungan_terakhir",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Kunjungan Terakhir
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.tanggal_kunjungan_terakhir)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-center">Aksi</div>,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              Lihat Detail
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(row.original)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];

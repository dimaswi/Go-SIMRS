import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, XCircle, Printer } from "lucide-react";
import type { Registration } from "@/lib/api/queue";
import {
  registrationStatusLabels,
  paymentMethodLabels,
} from "@/lib/api/queue";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ColumnOptions {
  onView: (id: number) => void;
  onPrint: (registration: Registration) => void;
  onCancel: (id: number) => void;
  hasViewPermission: boolean;
  hasDeletePermission: boolean;
}

// Helper to get ID from registration (handles both ID and id)
const getRegistrationId = (reg: Registration): number => {
  return reg.ID || reg.id || 0;
};

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_queue: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const paymentColors: Record<string, string> = {
  cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  bpjs: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  insurance: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function createRegistrationColumns(
  options: ColumnOptions
): ColumnDef<Registration>[] {
  return [
    {
      accessorKey: "registration_number",
      header: "No. Registrasi",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          {row.original.registration_number}
        </span>
      ),
    },
    {
      accessorKey: "registration_date",
      header: "Tanggal",
      cell: ({ row }) =>
        format(new Date(row.original.registration_date), "dd MMM yyyy", {
          locale: localeId,
        }),
    },
    {
      accessorKey: "patient",
      header: "Pasien",
      cell: ({ row }) => {
        const patient = row.original.patient;
        return patient ? (
          <div>
            <div className="font-medium">{patient.name}</div>
            <div className="text-xs text-muted-foreground">
              {patient.medical_record_number}
            </div>
          </div>
        ) : (
          "-"
        );
      },
    },
    {
      accessorKey: "destination_room",
      header: "Poli/Ruangan",
      cell: ({ row }) => row.original.destination_room?.name || "-",
    },
    {
      accessorKey: "doctor",
      header: "Dokter",
      cell: ({ row }) => {
        const doctor = row.original.doctor;
        return doctor?.name || "-";
      },
    },
    {
      accessorKey: "payment_method",
      header: "Pembayaran",
      cell: ({ row }) => (
        <Badge className={paymentColors[row.original.payment_method]}>
          {paymentMethodLabels[row.original.payment_method]}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={statusColors[row.original.status]}>
          {registrationStatusLabels[row.original.status]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const reg = row.original;
        const hasRoomQueue = reg.visit?.room_queue;
        const regId = getRegistrationId(reg);
        
        return (
          <div className="flex justify-end gap-1">
            {hasRoomQueue && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => options.onPrint(reg)}
                title="Print Nomor Antrian"
              >
                <Printer className="h-4 w-4" />
              </Button>
            )}
            {options.hasViewPermission && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => options.onView(regId)}
                title="Lihat Detail"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {reg.status !== "cancelled" &&
              reg.status !== "completed" &&
              options.hasDeletePermission && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => options.onCancel(regId)}
                  title="Batalkan"
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              )}
          </div>
        );
      },
    },
  ];
}

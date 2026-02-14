import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, XCircle, Printer, Loader2, ChevronDown, Ticket, User, Smartphone, CheckCircle } from "lucide-react";
import type { Registration } from "@/lib/api/queue";
import type { BPJSQueue } from "@/lib/api/bpjs";
import {
  registrationStatusLabels,
  paymentMethodLabels,
} from "@/lib/api/queue";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ColumnOptions {
  onView: (id: number) => void;
  onPrintQueueTicket: (registration: Registration) => void;
  onPrintPatientLabel: (registration: Registration) => void;
  onCancel: (id: number) => void;
  onCancelMjkn: (queueId: number) => void;
  onActivateMjkn: (queueId: number) => void;
  hasViewPermission: boolean;
  hasDeletePermission: boolean;
  printingType?: { regId: number; type: 'queue' | 'label' } | null;
  mjknQueueMap: Map<number, BPJSQueue>;
  activatingCheckin: number | null;
}

// Helper to get ID from registration (handles both ID and id)
const getRegistrationId = (reg: Registration): number => {
  return reg.ID || reg.id || 0;
};

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  scheduled: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  in_queue: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  discharged: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  no_show: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300",
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
      cell: ({ row }) => {
        const regId = getRegistrationId(row.original);
        const mjknQueue = options.mjknQueueMap.get(regId);

        return (
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">
              {row.original.registration_number}
            </span>
            {mjknQueue && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-100 text-blue-600 flex-shrink-0">
                      <Smartphone className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mobile JKN - {mjknQueue.kode_booking}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
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
      cell: ({ row }) => {
        const status = row.original.status;
        const colorClass = statusColors[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
        const label = registrationStatusLabels[status] || status || "-";
        return (
          <Badge className={colorClass}>
            {label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const reg = row.original;
        const hasRoomQueue = reg.visit?.room_queue;
        const hasPatient = reg.patient;
        const regId = getRegistrationId(reg);
        const mjknQueue = options.mjknQueueMap.get(regId);
        const isMjknPending = mjknQueue && mjknQueue.status === "booking";

        const isPrintingQueue = options.printingType?.regId === regId && options.printingType?.type === 'queue';
        const isPrintingLabel = options.printingType?.regId === regId && options.printingType?.type === 'label';
        const isPrinting = isPrintingQueue || isPrintingLabel;

        return (
          <div className="flex justify-end gap-1">
            {/* Aktivasi button for pending MJKN */}
            {isMjknPending && (
              <Button
                size="sm"
                onClick={() => options.onActivateMjkn(mjknQueue.id)}
                disabled={options.activatingCheckin === mjknQueue.id}
                className="bg-blue-600 hover:bg-blue-700 gap-1"
              >
                {options.activatingCheckin === mjknQueue.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Aktivasi
                  </>
                )}
              </Button>
            )}

            {/* Print Dropdown */}
            {(hasRoomQueue || hasPatient) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPrinting}
                    className="gap-1"
                  >
                    {isPrinting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hasRoomQueue && (
                    <DropdownMenuItem
                      onClick={() => options.onPrintQueueTicket(reg)}
                      disabled={isPrintingQueue}
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      Tiket Antrian
                    </DropdownMenuItem>
                  )}
                  {hasPatient && (
                    <DropdownMenuItem
                      onClick={() => options.onPrintPatientLabel(reg)}
                      disabled={isPrintingLabel}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Label Pasien
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
            {/* Cancel: MJKN queue or regular registration */}
            {reg.status !== "cancelled" &&
              reg.status !== "completed" &&
              options.hasDeletePermission && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isMjknPending) {
                      options.onCancelMjkn(mjknQueue.id);
                    } else {
                      options.onCancel(regId);
                    }
                  }}
                  title={isMjknPending ? "Batalkan Antrian MJKN" : "Batalkan"}
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

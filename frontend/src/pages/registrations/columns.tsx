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
import { Eye, XCircle, Printer, Loader2, Ticket, User, Smartphone, CheckCircle, Stethoscope, BedDouble, Pencil, GitBranch } from "lucide-react";
import type { Registration } from "@/lib/api/queue";
import type { BPJSQueue } from "@/lib/api/bpjs";
import {
  registrationStatusLabels,
  paymentMethodLabels,
} from "@/lib/api/queue";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatPatientName } from "@/lib/print-utils";
import { cn } from "@/lib/utils";

interface ColumnOptions {
  onView: (id: number) => void;
  onViewJourney: (registration: Registration) => void;
  onPrintQueueTicket: (registration: Registration) => void;
  onPrintPatientLabel: (registration: Registration) => void;
  onCancel: (id: number) => void;
  onCancelMjkn: (queueId: number) => void;
  onActivateMjkn: (queueId: number) => void;
  onEditPayment: (registration: Registration) => void;
  onCreateSPRI: (registration: Registration) => void;
  onCreateSEPRanap: (registration: Registration) => void;
  onViewSPRI: (registration: Registration) => void;
  onViewSEPRanap: (registration: Registration) => void;
  onViewSEPOutpatient: (registration: Registration) => void;
  hasViewPermission: boolean;
  hasDeletePermission: boolean;
  printingType?: { regId: number; type: 'queue' | 'label' } | null;
  mjknQueueMap: Map<number, BPJSQueue>;
  activatingCheckin: number | null;
  spriMap: Map<number, { no_spri: string; is_bpjs: boolean }>;
  sepRanapMap: Map<number, string>;
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
  cancelled: "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-400",
  no_show: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300",
};

const paymentColors: Record<string, string> = {
  cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  bpjs: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  insurance: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const columnHeader = (label: string, className = "") => (
  <div className={className}>{label}</div>
);

export function createRegistrationColumns(
  options: ColumnOptions
): ColumnDef<Registration>[] {
  return [
    {
      accessorKey: "registration_number",
      header: () => columnHeader("No. Registrasi", "w-[200px]"),
      cell: ({ row }) => {
        const reg = row.original;
        const regId = getRegistrationId(reg);
        const mjknQueue = options.mjknQueueMap.get(regId);

        const status = reg.status;
        const statusColorClass = statusColors[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
        const statusLabel = registrationStatusLabels[status] || status || "-";

        const canEditPayment = reg.status !== "cancelled" && reg.status !== "completed";

        return (
          <div className="flex flex-col min-w-0 gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium break-all">
                {reg.registration_number}
              </span>
              {mjknQueue && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-100 text-blue-600 flex-shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mobile JKN - {mjknQueue.kode_booking}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={cn(statusColorClass, "h-5 px-1.5 text-[10px] py-0 leading-none")}>
                {statusLabel}
              </Badge>
              <Badge
                className={cn(
                  paymentColors[reg.payment_method],
                  canEditPayment ? "cursor-pointer hover:opacity-80" : "",
                  "h-5 w-fit px-1.5 text-[10px] py-0 leading-none"
                )}
                onClick={canEditPayment ? () => options.onEditPayment(reg) : undefined}
              >
                {paymentMethodLabels[reg.payment_method]}
                {canEditPayment && <Pencil className="h-2.5 w-2.5 ml-1" />}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "registration_date",
      header: () => columnHeader("Tanggal", "w-[112px]"),
      cell: ({ row }) => {
        const reg = row.original;
        const queueNumber = reg.visit?.room_queue?.queue_number;
        return (
          <div className="min-w-0">
            <div className="text-sm">
              {format(new Date(reg.registration_date), "dd MMM yyyy", {
                locale: localeId,
              })}
            </div>
            {queueNumber && (
              <div className="text-xs text-muted-foreground font-mono">
                Antrian: {queueNumber}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "patient",
      header: () => columnHeader("Pasien", "w-[280px]"),
      cell: ({ row }) => {
        const reg = row.original;
        const patient = reg.patient;
        const regId = getRegistrationId(reg);
        const sepRanapNo = options.sepRanapMap.get(regId);
        if (!patient) return "-";
        const name = formatPatientName(patient.nama_lengkap || patient.name, patient.jenis_kelamin, undefined, patient.tanggal_lahir) || "-";
        const mrn = patient.no_rm || patient.medical_record_number || "";
        return (
          <div className="min-w-0 max-w-[320px] space-y-0.5">
            <div className="font-medium text-sm leading-5 break-words">{name}</div>
            {mrn && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                {mrn}
              </div>
            )}
            {sepRanapNo && (
              <div className="text-[11px] leading-4 text-muted-foreground break-all">
                No. SEP: <span className="font-mono">{sepRanapNo}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "destination_room",
      header: () => columnHeader("Poli/Ruangan", "w-[190px]"),
      cell: ({ row }) => {
        const room = row.original.destination_room;
        if (!room) return "-";

        // Check if this registration has an inpatient visit
        const inpatientVisit = row.original.visits?.find(
          (v) => v.visit_type === "inpatient" && v.status !== "cancelled"
        );

        return (
          <div className="min-w-0 max-w-[220px]">
            <div className="text-sm leading-5 truncate">{room.name}</div>
            {inpatientVisit ? (
              <div className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1 leading-4">
                <BedDouble className="h-3 w-3 shrink-0" />
                <span className="truncate">{room.name} → {inpatientVisit.room?.name || "Rawat Inap"}</span>
              </div>
            ) : (
              room.code && (
                <div className="text-xs text-muted-foreground truncate">{room.code}</div>
              )
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "doctor",
      header: () => columnHeader("Dokter", "w-[170px]"),
      cell: ({ row }) => {
        const doctor = row.original.doctor;
        if (!doctor) return <span className="text-muted-foreground">-</span>;
        const name = doctor.nama_lengkap || doctor.nama || doctor.name || "-";
        return (
          <div className="flex min-w-0 max-w-[190px] items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm leading-5 truncate">{name}</span>
          </div>
        );
      },
    },
    {
      id: "bpjs_triggers",
      header: () => columnHeader("Doc", "w-[100px]"),
      cell: ({ row }) => {
        const reg = row.original;
        // If not BPJS, don't show the triggers at all
        if (reg.payment_method !== "bpjs") return <span className="text-muted-foreground">-</span>;

        const regId = getRegistrationId(reg);
        const isInpatient = reg.registration_type === "inpatient" || reg.destination_room?.service_type === "rawat_inap";

        if (!isInpatient) {
          const sepNo = reg.sep_number;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {sepNo ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => options.onViewSEPOutpatient(reg)}
                        className="inline-flex items-center rounded-sm"
                      >
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0 h-5 gap-0.5 cursor-pointer hover:bg-green-100">
                          <CheckCircle className="h-3 w-3" />
                          SEP
                        </Badge>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Lihat detail SEP: {sepNo}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted px-1.5 py-0 h-5">
                  SEP
                </Badge>
              )}
            </div>
          );
        }

        const spriData = options.spriMap.get(regId);
        const sepRanapNo = options.sepRanapMap.get(regId);

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {spriData ? (
              (spriData.is_bpjs || !spriData.no_spri.startsWith("LOCAL-")) ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => options.onViewSPRI(reg)}
                        className="inline-flex items-center rounded-sm"
                      >
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0 h-5 gap-0.5 cursor-pointer hover:bg-green-100">
                          <CheckCircle className="h-3 w-3" />
                          SPRI
                        </Badge>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Lihat detail SPRI: {spriData.no_spri}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => options.onCreateSPRI(reg)}
                        className="inline-flex items-center rounded-sm"
                      >
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 h-5 gap-0.5 cursor-pointer hover:bg-amber-100">
                          SPRI
                        </Badge>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Draft Lokal — belum terkirim ke BPJS</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            ) : (
              <button
                type="button"
                onClick={() => options.onCreateSPRI(reg)}
                className="text-blue-600 hover:text-blue-800 underline text-[10px] leading-none cursor-pointer"
              >
                SPRI
              </button>
            )}
            {sepRanapNo ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => options.onViewSEPRanap(reg)}
                      className="inline-flex items-center rounded-sm"
                    >
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0 h-5 gap-0.5 cursor-pointer hover:bg-green-100">
                        <CheckCircle className="h-3 w-3" />
                        SEP
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Lihat detail SEP: {sepRanapNo}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : spriData ? (
              <button
                type="button"
                onClick={() => options.onCreateSEPRanap(reg)}
                className="text-blue-600 hover:text-blue-800 underline text-[10px] leading-none cursor-pointer"
              >
                SEP
              </button>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted px-1.5 py-0 h-5">
                SEP
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="w-[100px] text-right">Aksi</div>,
      cell: ({ row }) => {
        const reg = row.original;
        const hasRoomQueue = reg.visit?.room_queue;
        const hasPatient = reg.patient;
        const regId = getRegistrationId(reg);
        const mjknQueue = options.mjknQueueMap.get(regId);
        const isMjknPending = mjknQueue && mjknQueue.status === "booking" && reg.status !== "cancelled";

        const isPrintingQueue = options.printingType?.regId === regId && options.printingType?.type === 'queue';
        const isPrintingLabel = options.printingType?.regId === regId && options.printingType?.type === 'label';
        const isPrinting = isPrintingQueue || isPrintingLabel;

        return (
          <TooltipProvider delayDuration={300}>
            <div className="flex justify-end gap-1">
              {/* Aktivasi button for pending MJKN */}
              {isMjknPending && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={() => options.onActivateMjkn(mjknQueue.id)}
                      disabled={options.activatingCheckin === mjknQueue.id}
                      className="bg-blue-600 hover:bg-blue-700 h-8 w-8"
                    >
                      {options.activatingCheckin === mjknQueue.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Aktivasi MJKN</TooltipContent>
                </Tooltip>
              )}

              {/* Print Dropdown */}
              {(hasRoomQueue || hasPatient) && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isPrinting}
                          className="h-8 w-8"
                        >
                          {isPrinting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Cetak</TooltipContent>
                  </Tooltip>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => options.onViewJourney(reg)}
                      className="h-8 w-8"
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Perjalanan Pasien</TooltipContent>
                </Tooltip>
              )}

              {options.hasViewPermission && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => options.onView(regId)}
                      className="h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Lihat Detail</TooltipContent>
                </Tooltip>
              )}
              {/* Cancel: MJKN queue or regular registration */}
              {reg.status !== "cancelled" &&
                reg.status !== "completed" &&
                options.hasDeletePermission && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (isMjknPending) {
                            options.onCancelMjkn(mjknQueue.id);
                          } else {
                            options.onCancel(regId);
                          }
                        }}
                        className="h-8 w-8"
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isMjknPending ? "Batalkan Antrian MJKN" : "Batalkan"}</TooltipContent>
                  </Tooltip>
                )}
            </div>
          </TooltipProvider>
        );
      },
    },
  ];
}

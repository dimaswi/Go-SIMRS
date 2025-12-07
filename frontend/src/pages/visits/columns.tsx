import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, PhoneCall, Loader2, UserCheck } from "lucide-react";

interface Visit {
  id: number;
  visit_number: string;
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  complaint?: string;
  registration?: {
    id: number;
    registration_number: string;
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin: string;
      tanggal_lahir?: string;
    };
  };
  room?: {
    id: number;
    code: string;
    name: string;
  };
  doctor?: {
    id: number;
    nama_lengkap: string;
  };
  room_queue?: {
    id: number;
    queue_number: string;
    status: string;
    priority: string;
  };
}

interface CreateColumnsProps {
  onCallQueue: (visit: Visit) => void;
  onRecallQueue: (visit: Visit) => void;
  onAcceptPatient: (visit: Visit) => void;
  onViewDetail: (id: number) => void;
  callingId: number | null;
  recallingId: number | null;
  acceptingId: number | null;
  hasCallPermission: boolean;
  hasAcceptPermission: boolean;
  hasViewPermission: boolean;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; label: string }> = {
    waiting: { variant: "secondary", label: "Menunggu" },
    in_queue: { variant: "default", label: "Dalam Antrian" },
    in_progress: { variant: "default", label: "Sedang Dilayani" },
    completed: { variant: "outline", label: "Selesai" },
    cancelled: { variant: "destructive", label: "Dibatalkan" },
  };
  const config = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getPriorityBadge = (priority?: string) => {
  if (!priority) return null;
  const variants: Record<string, { variant: any; label: string }> = {
    normal: { variant: "outline", label: "Normal" },
    urgent: { variant: "default", label: "Mendesak" },
    emergency: { variant: "destructive", label: "Darurat" },
  };
  const config = variants[priority] || { variant: "outline", label: priority };
  return <Badge variant={config.variant} className="ml-2">{config.label}</Badge>;
};

const getQueueStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; label: string }> = {
    waiting: { variant: "secondary", label: "Menunggu" },
    called: { variant: "default", label: "Dipanggil" },
    serving: { variant: "default", label: "Dilayani" },
    completed: { variant: "outline", label: "Selesai" },
    skipped: { variant: "destructive", label: "Dilewati" },
    cancelled: { variant: "destructive", label: "Dibatalkan" },
  };
  const config = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const createVisitColumns = ({
  onCallQueue,
  onRecallQueue,
  onAcceptPatient,
  onViewDetail,
  callingId,
  recallingId,
  acceptingId,
  hasCallPermission,
  hasAcceptPermission,
  hasViewPermission,
}: CreateColumnsProps): ColumnDef<Visit>[] => [
  {
    accessorKey: "room_queue.queue_number",
    header: "No. Antrian",
    cell: ({ row }) => {
      const queue = row.original.room_queue;
      return (
        <div className="font-medium">
          {queue?.queue_number || "-"}
          {getPriorityBadge(queue?.priority)}
        </div>
      );
    },
  },
  {
    accessorKey: "visit_number",
    header: "No. Kunjungan",
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.original.visit_number}</div>
    ),
  },
  {
    accessorKey: "registration.patient.no_rm",
    header: "No. RM",
    cell: ({ row }) => (
      <div className="font-mono text-sm">
        {row.original.registration?.patient?.no_rm || "-"}
      </div>
    ),
  },
  {
    accessorKey: "registration.patient.nama_lengkap",
    header: "Nama Pasien",
    cell: ({ row }) => (
      <div className="font-medium">
        {row.original.registration?.patient?.nama_lengkap || "-"}
      </div>
    ),
  },
  {
    accessorKey: "doctor.nama_lengkap",
    header: "Dokter",
    cell: ({ row }) => (
      <div>{row.original.doctor?.nama_lengkap || "-"}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status Kunjungan",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "room_queue.status",
    header: "Status Antrian",
    cell: ({ row }) => {
      const queue = row.original.room_queue;
      return queue ? getQueueStatusBadge(queue.status) : <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: "check_in_time",
    header: "Check-in",
    cell: ({ row }) => {
      const time = row.original.check_in_time;
      return time
        ? new Date(time).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => {
      const visit = row.original;
      const canCall = hasCallPermission && visit.room_queue?.status === "waiting";
      const canRecall = hasCallPermission && 
        visit.room_queue?.status === "called" && 
        visit.status !== "in_progress";
      
      // Can accept if:
      // - Has accept permission
      // - Queue has been called (room_queue status = called)
      // - Visit status is not yet in_progress or completed
      // - For UGD without queue: can accept directly from waiting status
      const canAccept = hasAcceptPermission && 
        visit.status !== "in_progress" && 
        visit.status !== "completed" &&
        (
          visit.room_queue?.status === "called" ||
          (visit.status === "waiting" && !visit.room_queue)
        );
      
      // Can view detail:
      // - Patient has been accepted (status is in_progress or completed)
      const canViewDetail = hasViewPermission && 
        (visit.status === "in_progress" || visit.status === "completed");
      
      return (
        <div className="flex justify-end gap-2">
          {canCall && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onCallQueue(visit)}
              disabled={callingId === visit.id}
            >
              {callingId === visit.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-1" />
                  Panggil
                </>
              )}
            </Button>
          )}
          {canRecall && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecallQueue(visit)}
              disabled={recallingId === visit.id}
            >
              {recallingId === visit.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-1" />
                  Panggil Ulang
                </>
              )}
            </Button>
          )}
          {canAccept && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onAcceptPatient(visit)}
              disabled={acceptingId === visit.id}
              className="bg-green-600 hover:bg-green-700"
            >
              {acceptingId === visit.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Terima
                </>
              )}
            </Button>
          )}
          {canViewDetail && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetail(visit.id)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Detail
            </Button>
          )}
        </div>
      );
    },
  },
];

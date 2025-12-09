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
  referral_from?: number; // ID visit asal jika ini adalah visit order
  status: string;
  check_in_time?: string;
  end_time?: string;
  created_at?: string;
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

// Cek apakah ini kunjungan order atau kunjungan normal
// Visit order memiliki referral_from (rujukan dari visit lain)
const getVisitCategoryBadge = (visit: Visit) => {
  const isOrder = visit.referral_from !== null && visit.referral_from !== undefined;
  
  if (isOrder) {
    const orderLabels: Record<string, string> = {
      lab: "🧪 Order Lab",
      radiology: "📷 Order Radiologi",
      consultation: "👨‍⚕️ Order Konsultasi",
      pharmacy: "💊 Order Farmasi",
    };
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
        {orderLabels[visit.visit_type] || "Order"}
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      📋 Pendaftaran
    </Badge>
  );
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
    accessorKey: "visit_type",
    header: "Jenis",
    cell: ({ row }) => getVisitCategoryBadge(row.original),
  },
  {
    accessorKey: "room.name",
    header: "Ruangan",
    cell: ({ row }) => (
      <div>{row.original.room?.name || "-"}</div>
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
    accessorKey: "check_in_time",
    header: "Tanggal Masuk",
    cell: ({ row }) => {
      // Use check_in_time if available, otherwise fallback to created_at
      const time = row.original.check_in_time || row.original.created_at;
      return time
        ? new Date(time).toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
    },
  },
  {
    accessorKey: "end_time",
    header: "Tanggal Keluar",
    cell: ({ row }) => {
      const time = row.original.end_time;
      return time
        ? new Date(time).toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
    },
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
    id: "actions",
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => {
      const visit = row.original;
      
      // Check if this is an emergency visit (UGD)
      const isEmergency = visit.visit_type === "emergency" || 
        visit.room?.name?.toLowerCase().includes("ugd") ||
        visit.room?.name?.toLowerCase().includes("igd");
      
      // Check if this is an inpatient visit (Rawat Inap)
      const isInpatient = visit.visit_type === "inpatient" ||
        visit.room?.name?.toLowerCase().includes("rawat inap") ||
        visit.room?.name?.toLowerCase().includes("ranap");
      
      // Check if room has no queue system (no room_queue data)
      const hasNoQueueSystem = !visit.room_queue;
      
      // UGD dan Rawat Inap tidak menggunakan sistem antrian, langsung dilayani
      const canCall = hasCallPermission && 
        !isEmergency && 
        !isInpatient &&
        !hasNoQueueSystem &&
        visit.room_queue?.status === "waiting";
      
      const canRecall = hasCallPermission && 
        !isEmergency && 
        !isInpatient &&
        !hasNoQueueSystem &&
        visit.room_queue?.status === "called" && 
        visit.status !== "in_progress";
      
      // Can accept if:
      // - Has accept permission
      // - Visit status is not yet in_progress or completed
      // - For UGD/emergency/inpatient/rooms without queue: can accept directly from waiting or in_queue status
      // - For regular rooms with queue: only after queue has been called
      const canAccept = hasAcceptPermission && 
        visit.status !== "in_progress" && 
        visit.status !== "completed" &&
        (
          ((isEmergency || isInpatient || hasNoQueueSystem) && (visit.status === "waiting" || visit.status === "in_queue")) ||
          visit.room_queue?.status === "called"
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

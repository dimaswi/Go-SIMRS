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
  bed_id?: number;
  bed?: {
    id: number;
    bed_number: string;
    status: string;
  };
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
    service_type?: string;
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

// Calculate age from birth date
const calculateAge = (birthDate: string) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

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
// HANYA support visit (lab/rad/pharmacy/consultation) yang punya referral_from yang dianggap order
// Inpatient/rawat jalan/UGD BUKAN order meskipun punya referral_from
const getVisitCategoryBadge = (visit: Visit) => {
  const supportVisitTypes = ["lab", "radiology", "pharmacy", "consultation"];
  const isOrder = visit.referral_from !== null && 
                  visit.referral_from !== undefined && 
                  supportVisitTypes.includes(visit.visit_type);
  
  if (isOrder) {
    const orderLabels: Record<string, string> = {
      lab: "Order Lab",
      radiology: "Order Radiologi",
      consultation: "Order Konsultasi",
      pharmacy: "Order Farmasi",
    };
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
        {orderLabels[visit.visit_type] || "Order"}
      </Badge>
    );
  }
  
  // Service type based badges
  const serviceType = visit.room?.service_type;
  if (serviceType === "rawat_inap" || visit.visit_type === "inpatient") {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
        🛏️ Ranap
      </Badge>
    );
  }
  if (serviceType === "gawat_darurat" || visit.visit_type === "emergency") {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
        🚨 UGD
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
      🏃 Rajal
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
    header: "Antrian",
    cell: ({ row }) => {
      const queue = row.original.room_queue;
      if (!queue?.queue_number) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-lg">{queue.queue_number}</span>
          {queue.priority && queue.priority !== "normal" && (
            <Badge 
              variant={queue.priority === "emergency" ? "destructive" : "default"} 
              className="text-[10px] px-1 py-0 w-fit"
            >
              {queue.priority === "emergency" ? "Darurat" : "Mendesak"}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: "patient_info",
    header: "Pasien",
    cell: ({ row }) => {
      const patient = row.original.registration?.patient;
      const age = patient?.tanggal_lahir 
        ? calculateAge(patient.tanggal_lahir) 
        : null;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{patient?.nama_lengkap || "-"}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{patient?.no_rm || "-"}</span>
            {patient?.jenis_kelamin && (
              <>
                <span>•</span>
                <span>{patient.jenis_kelamin === "L" ? "L" : "P"}</span>
              </>
            )}
            {age !== null && (
              <>
                <span>•</span>
                <span>{age} th</span>
              </>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "visit_type",
    header: "Jenis",
    cell: ({ row }) => getVisitCategoryBadge(row.original),
  },
  {
    id: "room_bed",
    header: "Ruangan / Bed",
    cell: ({ row }) => {
      const visit = row.original;
      const isInpatient = visit.room?.service_type === "rawat_inap" || visit.visit_type === "inpatient";
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{visit.room?.name || "-"}</span>
          {isInpatient && visit.bed && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 w-fit bg-green-50 text-green-700 border-green-200">
              🛏️ {visit.bed.bed_number}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "doctor.nama_lengkap",
    header: "Dokter",
    cell: ({ row }) => (
      <div className="text-sm">{row.original.doctor?.nama_lengkap || "-"}</div>
    ),
  },
  {
    accessorKey: "check_in_time",
    header: "Waktu Masuk",
    cell: ({ row }) => {
      // Use check_in_time if available, otherwise fallback to created_at
      const time = row.original.check_in_time || row.original.created_at;
      if (!time) return <span className="text-muted-foreground text-xs">-</span>;
      const date = new Date(time);
      return (
        <div className="flex flex-col text-xs">
          <span>{date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
          <span className="text-muted-foreground">{date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      );
    },
  },
  {
    id: "combined_status",
    header: "Status",
    cell: ({ row }) => {
      const visit = row.original;
      const queue = visit.room_queue;
      return (
        <div className="flex flex-col gap-1">
          {getStatusBadge(visit.status)}
          {queue && queue.status !== visit.status && (
            <span className="text-[10px] text-muted-foreground">
              Antrian: {getQueueStatusBadge(queue.status)}
            </span>
          )}
        </div>
      );
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

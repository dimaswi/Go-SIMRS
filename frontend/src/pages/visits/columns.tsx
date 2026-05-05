import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, PhoneCall, Loader2, UserCheck, XCircle } from "lucide-react";
import { formatPatientName } from "@/lib/print-utils";

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
  // SEP linked to this visit (by visit_id)
  sep?: {
    id: number;
    no_sep: string;
  };
  registration?: {
    id: number;
    registration_number: string;
    payment_method?: string;
    sep_number?: string;
    sep?: {
      id: number;
      no_sep: string;
    };
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
    room_type?: string;
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
  onCancelVisit: (visit: Visit) => void;
  onViewDetail: (id: number) => void;
  callingId: number | null;
  recallingId: number | null;
  acceptingId: number | null;
  cancellingId: number | null;
  hasCallPermission: boolean;
  hasAcceptPermission: boolean;
  hasViewPermission: boolean;
  hasCancelPermission: boolean;
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
  const serviceType = visit.room?.service_type;
  const roomType = (visit.room?.room_type || "").toLowerCase();

  if (visit.visit_type === "lab" || serviceType === "penunjang_medis" && roomType.includes("laboratorium")) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
        Order Laboratorium
      </Badge>
    );
  }
  if (visit.visit_type === "radiology" || serviceType === "penunjang_medis" && roomType === "radiologi") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
        Order Radiologi
      </Badge>
    );
  }
  if (visit.visit_type === "pharmacy" || serviceType === "farmasi") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
        Order Farmasi
      </Badge>
    );
  }

  const supportVisitTypes = ["consultation", "surgery"];
  const isOrder = visit.referral_from !== null &&
    visit.referral_from !== undefined &&
    supportVisitTypes.includes(visit.visit_type);

  if (isOrder) {
    const orderLabels: Record<string, string> = {
      consultation: "Order Konsultasi",
      surgery: "Order Operasi",
    };
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
        {orderLabels[visit.visit_type] || "Order"}
      </Badge>
    );
  }

  if (serviceType === "rawat_inap" || visit.visit_type === "inpatient") {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
        Rawat Inap
      </Badge>
    );
  }
  if (serviceType === "gawat_darurat" || visit.visit_type === "emergency") {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
        UGD
      </Badge>
    );
  }
  if (visit.visit_type === "surgery" || visit.room?.room_type === "ok") {
    return (
      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
        Operasi
      </Badge>
    );
  }

  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
      Rawat Jalan
    </Badge>
  );
};

export const createVisitColumns = ({
  onCallQueue,
  onRecallQueue,
  onAcceptPatient,
  onCancelVisit,
  onViewDetail,
  callingId,
  recallingId,
  acceptingId,
  cancellingId,
  hasCallPermission,
  hasAcceptPermission,
  hasViewPermission,
  hasCancelPermission,
}: CreateColumnsProps): ColumnDef<Visit>[] => [
    {
      accessorKey: "room_queue.queue_number",
      header: "Antrian",
      cell: ({ row }) => {
        const queue = row.original.room_queue;
        if (!queue?.queue_number) return <span className="text-muted-foreground text-xs">-</span>;
        
        const isUrgent = queue.priority && queue.priority !== "normal";
        
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`font-bold text-lg ${isUrgent ? 'text-destructive' : ''}`}>
              {queue.queue_number}
            </span>
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
            <span className="font-medium">{formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, undefined, patient?.tanggal_lahir)}</span>
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
          <div className="gap-0.5">
            <span className="text-sm">{visit.room?.name || "-"}</span>
            {isInpatient && visit.bed && (
              <span className="text-sm">{' / ' + visit.bed.bed_number}</span>
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
      id: "sep_number",
      header: "No. SEP",
      cell: ({ row }) => {
        const registration = row.original.registration;
        // Hanya tampilkan untuk pasien BPJS
        if (registration?.payment_method !== "bpjs") {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
        // Tampilkan hanya SEP yang benar-benar resolved dari backend, bukan raw `sep_number`
        // yang bisa tertinggal setelah SEP dibatalkan/dihapus.
        const sepNumber = row.original.sep?.no_sep || registration?.sep?.no_sep;
        if (!sepNumber) {
          return <span className="text-muted-foreground text-xs italic">Belum ada</span>;
        }
        return (
          <span className="font-mono text-xs">{sepNumber}</span>
        );
      },
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

        // Can cancel if:
        // - Has cancel permission
        // - Visit is not yet completed or cancelled
        const canCancel = hasCancelPermission &&
          visit.status !== "completed" &&
          visit.status !== "discharged" &&
          visit.status !== "cancelled";

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
                    <PhoneCall className="h-4 w-4" />
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
                    <PhoneCall className="h-4 w-4" />
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
                    <UserCheck className="h-4 w-4" />
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
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancelVisit(visit)}
                disabled={cancellingId === visit.id}
              >
                {cancellingId === visit.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Loader2, Send, CheckCircle, XCircle, AlertCircle, Activity, FileJson } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface Patient {
  id: number;
  no_rm: string;
  nik: string;
  nama_lengkap: string;
  satusehat_id?: string;
}

interface Employee {
  id: number;
  nik: string;
  nama_lengkap: string;
  tipe_karyawan: string;
  satusehat_id?: string;
}

interface Room {
  id: number;
  code: string;
  name: string;
  room_type: string;
  satusehat_id?: string;
}

interface Diagnosis {
  id: number;
  visit_id: number;
  icd10_code: string;
  icd10_name: string;
  type: string;
  clinical_status?: string;
  verification_status?: string;
  satusehat_condition_id?: string;
  satusehat_sent_at?: string;
}

interface VisitDiagnosisInfo {
  diagnoses: Diagnosis[];
  total: number;
  has_primary: boolean;
  sent_count: number;
  ready_to_send: boolean;
}

interface Visit {
  id: number;
  visit_number: string;
  status: string;
  satusehat_encounter_id?: string;
  satusehat_sync_status?: string;
  registration?: {
    patient?: Patient;
  };
  room?: Room;
  doctor?: Employee;
  check_in_time?: string;
  diagnosisInfo?: VisitDiagnosisInfo;
}

interface EncountersTabProps {
  visits: Visit[];
  sending: string | null;
  onSendEncounter: (visitId: number) => void;
  onPreviewEncounter: (visitId: number) => void;
  onViewStatus: (visitId: number) => void;
}

export function EncountersTab({ 
  visits, 
  sending, 
  onSendEncounter, 
  onPreviewEncounter,
  onViewStatus,
}: EncountersTabProps) {
  const visitColumns: ColumnDef<Visit>[] = [
    {
      accessorKey: "id",
      header: "ID",
      enableHiding: true,
      enableSorting: true,
    },
    {
      accessorKey: "visit_number",
      header: "No. Visit",
      enableSorting: false, // Disable sorting to preserve server order
      cell: ({ row }) => <span className="font-mono">{row.original.visit_number}</span>,
    },
    {
      id: "patient",
      header: "Pasien",
      cell: ({ row }) => {
        const visit = row.original;
        return (
          <div>
            <p>{visit.registration?.patient?.nama_lengkap || '-'}</p>
          </div>
        );
      },
    },
    {
      id: "room",
      header: "Ruangan",
      cell: ({ row }) => row.original.room?.name || '-',
    },
    {
      id: "doctor",
      header: "Dokter",
      cell: ({ row }) => row.original.doctor?.nama_lengkap || '-',
    },
    {
      id: "requirements",
      header: "Syarat Kirim",
      cell: ({ row }) => {
        const visit = row.original;
        const patientHasIHS = !!visit.registration?.patient?.satusehat_id;
        const doctorHasIHS = !!visit.doctor?.satusehat_id;
        const roomHasSatuSehat = !!visit.room?.satusehat_id;
        const hasPrimaryDiagnosis = visit.diagnosisInfo?.has_primary ?? false;
        const diagnosisCount = visit.diagnosisInfo?.total ?? 0;
        const alreadySent = !!visit.satusehat_encounter_id;
        const fulfilledCount = [patientHasIHS, doctorHasIHS, roomHasSatuSehat, hasPrimaryDiagnosis].filter(Boolean).length;

        if (alreadySent) {
          return (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Lengkap</span>
            </div>
          );
        }

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex gap-0.5">
                {[patientHasIHS, doctorHasIHS, roomHasSatuSehat, hasPrimaryDiagnosis].map((fulfilled, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-4 rounded-full ${fulfilled ? 'bg-green-500' : 'bg-red-300'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{fulfilledCount}/4</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full ${patientHasIHS ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={patientHasIHS ? 'text-foreground' : 'text-muted-foreground'}>Pasien</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full ${doctorHasIHS ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={doctorHasIHS ? 'text-foreground' : 'text-muted-foreground'}>Dokter</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full ${roomHasSatuSehat ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={roomHasSatuSehat ? 'text-foreground' : 'text-muted-foreground'}>Ruangan</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full ${hasPrimaryDiagnosis ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={hasPrimaryDiagnosis ? 'text-foreground' : 'text-muted-foreground'}>
                  Dx {diagnosisCount > 0 && `(${diagnosisCount})`}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "satusehat_sync_status",
      header: "Status SatuSehat",
      cell: ({ row }) => {
        const visit = row.original;
        const alreadySent = !!visit.satusehat_encounter_id;
        
        if (alreadySent) {
          return (
            <Badge className="bg-green-100 text-green-800 gap-1">
              <CheckCircle className="h-3 w-3" />
              Terkirim
            </Badge>
          );
        }
        
        if (visit.satusehat_sync_status === 'failed') {
          return (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Gagal
            </Badge>
          );
        }
        
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Dikirim
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const visit = row.original;
        const patientHasIHS = !!visit.registration?.patient?.satusehat_id;
        const doctorHasIHS = !!visit.doctor?.satusehat_id;
        const roomHasSatuSehat = !!visit.room?.satusehat_id;
        const hasPrimaryDiagnosis = visit.diagnosisInfo?.has_primary ?? false;
        const alreadySent = !!visit.satusehat_encounter_id;
        const canSend = patientHasIHS && doctorHasIHS && roomHasSatuSehat && hasPrimaryDiagnosis && !alreadySent;

        // Build tooltip message for disabled button
        let disabledReason = "";
        if (!canSend && !alreadySent) {
          const missing = [];
          if (!patientHasIHS) missing.push("IHS Pasien");
          if (!doctorHasIHS) missing.push("IHS Dokter");
          if (!roomHasSatuSehat) missing.push("ID Ruangan");
          if (!hasPrimaryDiagnosis) missing.push("Diagnosis Utama");
          disabledReason = `Syarat belum lengkap: ${missing.join(", ")}`;
        }

        return (
          <div className="text-right flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewStatus(visit.id)}
              title="Lihat detail status pengiriman"
            >
              <Activity className="h-4 w-4 mr-2" />
              Status
            </Button>
            {canSend && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreviewEncounter(visit.id)}
                title="Preview data FHIR yang akan dikirim"
              >
                <FileJson className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendEncounter(visit.id)}
              disabled={!canSend || sending === `visit-${visit.id}`}
              title={!canSend ? disabledReason : "Kirim Encounter + Diagnosis ke SatuSehat"}
            >
              {sending === `visit-${visit.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Kirim
            </Button>
          </div>
        );
      },
    },
  ];


  // Sort visits by ID descending (newest first)
  const sortedVisits = [...visits].sort((a, b) => b.id - a.id);
  // Filter out supporting visits (farmasi, laboratorium, radiologi) by room name
  const filteredVisits = sortedVisits.filter(v => {
    const name = (v.room?.name || "").toLowerCase();
    return !["farmasi", "laboratorium", "radiologi"].some(keyword => name.includes(keyword));
  });

  // Clear stored page index when component mounts to always start from page 1
  React.useEffect(() => {
    try {
      localStorage.removeItem('dt_page_satusehat-encounters');
    } catch {}
  }, []);

  return (
    <DataTable
      columns={visitColumns}
      data={filteredVisits}
      searchPlaceholder="Cari nomor visit atau nama pasien..."
      pageSize={10}
      tableId="satusehat-encounters"
      initialColumnVisibility={{ id: false }}
    />
  );
}

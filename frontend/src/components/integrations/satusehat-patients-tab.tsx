import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Loader2, Search, CheckCircle, XCircle, AlertCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface Patient {
  id: number;
  no_rm: string;
  nik: string;
  nama_lengkap: string;
  satusehat_id?: string;
}

interface SendResponse {
  type: 'location' | 'encounter' | 'patient' | 'practitioner' | 'condition';
  success: boolean;
  title: string;
  data: Record<string, unknown>;
}

interface PatientsTabProps {
  patients: Patient[];
  sending: string | null;
  onLookupPatient: (patientId: number) => void;
  onShowResponse: (response: SendResponse) => void;
}

export function PatientsTab({ patients, sending, onLookupPatient, onShowResponse }: PatientsTabProps) {
  const patientColumns: ColumnDef<Patient>[] = [
    {
      accessorKey: "no_rm",
      header: "No. RM",
      cell: ({ row }) => <span className="font-mono">{row.original.no_rm}</span>,
    },
    {
      accessorKey: "nik",
      header: "NIK",
      cell: ({ row }) => <span className="font-mono">{row.original.nik || '-'}</span>,
    },
    {
      accessorKey: "nama_lengkap",
      header: "Nama Pasien",
    },
    {
      accessorKey: "satusehat_id",
      header: "Status IHS",
      cell: ({ row }) => {
        const patient = row.original;
        if (patient.satusehat_id) {
          return (
            <Badge className="bg-green-100 text-green-800 gap-1">
              <CheckCircle className="h-3 w-3" />
              {patient.satusehat_id.substring(0, 12)}...
            </Badge>
          );
        }
        if (patient.nik) {
          return (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Belum Lookup
            </Badge>
          );
        }
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            NIK Kosong
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <div className="text-right flex gap-2 justify-end">
            {patient.satusehat_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onShowResponse({
                    type: 'patient',
                    success: true,
                    title: `Pasien: ${patient.nama_lengkap}`,
                    data: {
                      id: patient.id,
                      no_rm: patient.no_rm,
                      nama_lengkap: patient.nama_lengkap,
                      nik: patient.nik,
                      ihs_number: patient.satusehat_id,
                      message: 'Data sudah terdaftar di SatuSehat'
                    },
                  });
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Detail
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLookupPatient(patient.id)}
                disabled={!patient.nik || sending === `patient-${patient.id}`}
              >
                {sending === `patient-${patient.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Lookup
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={patientColumns}
      data={[...patients].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))}
      searchPlaceholder="Cari nama, NIK, atau No. RM..."
      pageSize={10}
      tableId="satusehat-patients"
    />
  );
}

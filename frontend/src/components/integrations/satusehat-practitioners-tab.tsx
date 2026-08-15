import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Loader2, Search, CheckCircle, AlertCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface Employee {
  id: number;
  nik: string;
  nama_lengkap: string;
  tipe_karyawan: string;
  satusehat_id?: string;
}

interface SendResponse {
  type: 'location' | 'encounter' | 'patient' | 'practitioner' | 'condition';
  success: boolean;
  title: string;
  data: Record<string, unknown>;
}

interface PractitionersTabProps {
  employees: Employee[];
  sending: string | null;
  onLookupPractitioner: (employeeId: number) => void;
  onShowResponse: (response: SendResponse) => void;
}

export function PractitionersTab({ employees, sending, onLookupPractitioner, onShowResponse }: PractitionersTabProps) {
  const employeeColumns: ColumnDef<Employee>[] = [
    {
      accessorKey: "nik",
      header: "NIK",
      cell: ({ row }) => <span className="font-mono">{row.original.nik || '-'}</span>,
    },
    {
      accessorKey: "nama_lengkap",
      header: "Nama Karyawan",
    },
    {
      accessorKey: "tipe_karyawan",
      header: "Tipe",
      cell: ({ row }) => <Badge variant="outline">{row.original.tipe_karyawan}</Badge>,
    },
    {
      accessorKey: "satusehat_id",
      header: "Status IHS",
      cell: ({ row }) => {
        const employee = row.original;
        if (employee.satusehat_id) {
          return (
            <Badge className="bg-green-100 text-green-800 gap-1 hover:bg-green-200">
              <CheckCircle className="h-3 w-3" />
              {employee.satusehat_id.substring(0, 12)}...
            </Badge>
          );
        }
        if (employee.nik) {
          return (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-normal gap-1">
              <AlertCircle className="h-3 w-3" />
              Belum Lookup
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-normal gap-1">
            <AlertCircle className="h-3 w-3" />
            NIK Kosong
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="text-right flex gap-2 justify-end">
            {employee.satusehat_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onShowResponse({
                    type: 'practitioner',
                    success: true,
                    title: `${employee.tipe_karyawan}: ${employee.nama_lengkap}`,
                    data: {
                      id: employee.id,
                      nama_lengkap: employee.nama_lengkap,
                      nik: employee.nik,
                      tipe_karyawan: employee.tipe_karyawan,
                      ihs_number: employee.satusehat_id,
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
                onClick={() => onLookupPractitioner(employee.id)}
                disabled={!employee.nik || sending === `employee-${employee.id}`}
              >
                {sending === `employee-${employee.id}` ? (
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
      columns={employeeColumns}
      data={[...employees].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))}
      searchPlaceholder="Cari nama atau NIK..."
      pageSize={10}
      tableId="satusehat-practitioners"
    />
  );
}

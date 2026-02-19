import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { 
  RefreshCcw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Eye,
  ExternalLink,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { admissionRequestApi, type AdmissionRequest } from "@/lib/api/admission-request";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function AdmissionRequestsIndexPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AdmissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("pending");

  useEffect(() => {
    setPageTitle("Permintaan Rawat Inap");
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await admissionRequestApi.getAll({ 
        status: selectedStatus === "all" ? undefined : selectedStatus,
        limit: 1000
      });
      setRequests(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch admission requests:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data permintaan rawat inap",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getPatient = (request: AdmissionRequest) => {
    return request.patient || 
           request.registration?.patient || 
           request.source_visit?.registration?.patient;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" /> Menunggu</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Disetujui</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" /> Ditolak</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "emergency":
        return <Badge variant="destructive">Emergency</Badge>;
      case "urgent":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Urgent</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const columns: ColumnDef<AdmissionRequest>[] = [
    {
      accessorKey: "request_number",
      header: "No. Request",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.request_number}</span>
      ),
    },
    {
      accessorKey: "patient",
      header: "Pasien",
      cell: ({ row }) => {
        const patient = getPatient(row.original);
        return (
          <div>
            <Link
              to={`/patient-search/${patient?.id}`}
              className="font-medium hover:underline hover:text-primary"
            >
              {patient?.name || patient?.nama_lengkap || 'N/A'}
            </Link>
            <p className="text-xs text-muted-foreground">
              RM: {patient?.medical_record_number || patient?.no_rm || 'N/A'}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Prioritas",
      cell: ({ row }) => getPriorityBadge(row.original.priority),
    },
    {
      accessorKey: "admission_type",
      header: "Tipe",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.admission_type}</span>
      ),
    },
    {
      accessorKey: "source_visit",
      header: "Asal Unit",
      cell: ({ row }) => {
        const visit = row.original.source_visit;
        return visit?.id ? (
          <Link
            to={`/visits/${visit.id}`}
            className="hover:underline hover:text-primary flex items-center gap-1"
          >
            {visit?.room?.name || 'N/A'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span>{visit?.room?.name || 'N/A'}</span>
        );
      },
    },
    {
      accessorKey: "preferred_class",
      header: "Kelas Pilihan",
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.preferred_class?.replace(/_/g, ' ') || '-'}
        </span>
      ),
    },
    {
      accessorKey: "requested_at",
      header: "Tanggal Request",
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.requested_at
            ? format(new Date(row.original.requested_at), "dd MMM yyyy HH:mm", { locale: idLocale })
            : 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const request = row.original;
        if (request.status === "pending") {
          return (
            <Button size="sm" asChild>
              <Link to={`/admisi/${request.id}`}>
                <ArrowRight className="h-4 w-4 mr-1" />
                Proses
              </Link>
            </Button>
          );
        }
        return request.inpatient_visit_id ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/visits/${request.inpatient_visit_id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Lihat
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admisi/${request.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Detail
            </Link>
          </Button>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Permintaan Rawat Inap</h1>
          <p className="text-sm text-muted-foreground">Kelola permintaan rawat inap dari unit rawat jalan dan IGD</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchRequests}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
      <div className="flex items-center gap-2 flex-wrap pt-4">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
      </div>
      </CollapsibleContent>
      </Collapsible>
      <DataTable
        columns={columns}
        data={requests}
        searchPlaceholder="Cari no. request, nama pasien..."
        pageSize={10}
        tableId="admission-requests"
      />
    </div>
  );
}

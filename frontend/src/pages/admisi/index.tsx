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
      import { useState, useEffect, useCallback } from "react";
      import { Link } from "react-router-dom";
      import { Button } from "@/components/ui/button";
      import { Badge } from "@/components/ui/badge";
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
      } from "lucide-react";
      import { admissionRequestApi, type AdmissionRequest } from "@/lib/api/admission-request";
      import { useToast } from "@/hooks/use-toast";
      import { setPageTitle } from "@/lib/page-title";
      import { format } from "date-fns";
      import { id as idLocale } from "date-fns/locale";
      import { PageShell, PageHeader, FilterBar, FilterPill, PageContent } from "@/components/layout/page-shell";

      export default function AdmissionRequestsIndexPage() {
        const { toast } = useToast();
        const [requests, setRequests] = useState<AdmissionRequest[]>([]);
        const [loading, setLoading] = useState(true);
        const [selectedStatus, setSelectedStatus] = useState("pending");

        useEffect(() => {
          setPageTitle("Permintaan Rawat Inap");
        }, []);

        const fetchRequests = useCallback(async () => {
          try {
            setLoading(true);
            const response = await admissionRequestApi.getAll({
              status: selectedStatus === "all" ? undefined : selectedStatus,
              limit: 1000,
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
          return (
            request.patient ||
            request.registration?.patient ||
            request.source_visit?.registration?.patient
          );
        };

        const getStatusBadge = (status: string) => {
          switch (status) {
            case "pending":
              return (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  <Clock className="h-3 w-3 mr-1" /> Menunggu
                </Badge>
              );
            case "approved":
              return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" /> Disetujui
                </Badge>
              );
            case "rejected":
              return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                  <XCircle className="h-3 w-3 mr-1" /> Ditolak
                </Badge>
              );
            case "cancelled":
              return (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                  Dibatalkan
                </Badge>
              );
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
                    {patient?.name || patient?.nama_lengkap || "N/A"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    RM: {patient?.medical_record_number || patient?.no_rm || "N/A"}
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
            cell: ({ row }) => <span className="capitalize">{row.original.admission_type}</span>,
          },
          {
            id: "payment_method",
            header: "Pembayaran",
            cell: ({ row }) => {
              const pm = row.original.registration?.payment_method;
              if (pm === "bpjs") {
                return <Badge className="bg-green-100 text-green-700 border-green-300">BPJS</Badge>;
              }
              if (pm === "insurance") {
                return (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">Asuransi</Badge>
                );
              }
              return <Badge variant="secondary">Umum</Badge>;
            },
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
                  {visit?.room?.name || "N/A"}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span>{visit?.room?.name || "N/A"}</span>
              );
            },
          },
          {
            accessorKey: "preferred_class",
            header: "Kelas Pilihan",
            cell: ({ row }) => (
              <span className="capitalize">
                {row.original.preferred_class?.replace(/_/g, " ") || "-"}
              </span>
            ),
          },
          {
            accessorKey: "requested_at",
            header: "Tanggal Request",
            cell: ({ row }) => (
              <div className="text-sm">
                {row.original.requested_at
                  ? format(new Date(row.original.requested_at), "dd MMM yyyy HH:mm", {
                      locale: idLocale,
                    })
                  : "N/A"}
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

        return (
          <PageShell>
            <PageHeader
              title="Permintaan Rawat Inap"
              description="Kelola permintaan rawat inap dari unit rawat jalan dan IGD"
              count={requests.length}
              actions={
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchRequests}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              }
            />
            <FilterBar>
              <FilterPill active={selectedStatus === "all"} onClick={() => setSelectedStatus("all")}>
                Semua
              </FilterPill>
              <FilterPill
                active={selectedStatus === "pending"}
                onClick={() => setSelectedStatus("pending")}
              >
                <Clock className="h-3 w-3" /> Menunggu
              </FilterPill>
              <FilterPill
                active={selectedStatus === "approved"}
                onClick={() => setSelectedStatus("approved")}
              >
                <CheckCircle className="h-3 w-3" /> Disetujui
              </FilterPill>
              <FilterPill
                active={selectedStatus === "rejected"}
                onClick={() => setSelectedStatus("rejected")}
              >
                <XCircle className="h-3 w-3" /> Ditolak
              </FilterPill>
              <FilterPill
                active={selectedStatus === "cancelled"}
                onClick={() => setSelectedStatus("cancelled")}
              >
                Dibatalkan
              </FilterPill>
            </FilterBar>
            <PageContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={requests}
                  searchPlaceholder="Cari no. request, nama pasien..."
                  pageSize={10}
                  tableId="admission-requests"
                />
              )}
            </PageContent>
          </PageShell>
        );
      }

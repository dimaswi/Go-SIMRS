import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
// Card imports removed - header flattened
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { patientsApi, registrationApi, type Patient, type Registration } from "@/lib/api";
import { visitsApi, type Visit } from "@/lib/api/visits";
import { billingApi, type Billing } from "@/lib/api/billing";
import { vclaimApi, type SEPLocal } from "@/lib/api/vclaim";
import { printApi } from "@/lib/api/print";
import { admissionRequestApi, type AdmissionRequest } from "@/lib/api/admission-request";
import { setPageTitle } from "@/lib/page-title";
import { RegistrationSheet } from "@/components/registration/registration-sheet";
import { SEPDetailSheet } from "@/components/sep/sep-detail-sheet";
import {
  User,
  Loader2,
  MapPin,
  Phone,
  Users,
  Shield,
  Heart,
  ChevronDown,
  ChevronRight,
  FileText,
  FileSignature,
  UserCheck,
  AlertTriangle,
  CreditCard,
  Eye,
  Pencil,
  UserPlus,
  ClipboardList,
  FileCheck,
  Printer,
  Trash2,
  MoreHorizontal,
  BedDouble,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PatientSearchShow() {
  const { id: patientId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = searchParams.get("q") || "";
  const activeTab = searchParams.get("tab") || "detail";

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("tab", value);
      return prev;
    });
  };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [seps, setSeps] = useState<SEPLocal[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingBillings, setLoadingBillings] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loadingSeps, setLoadingSeps] = useState(false);
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [loadingAdmissionRequests, setLoadingAdmissionRequests] = useState(false);
  const [registrationSheetOpen, setRegistrationSheetOpen] = useState(false);
  const [deleteSepId, setDeleteSepId] = useState<SEPLocal | null>(null);
  const [deletingSep, setDeletingSep] = useState(false);
  const [selectedSep, setSelectedSep] = useState<SEPLocal | null>(null);
  const [sepDetailOpen, setSepDetailOpen] = useState(false);
  const [expandedRegistrations, setExpandedRegistrations] = useState<Set<number>>(new Set());

  const toggleRegistrationExpand = (regId: number) => {
    setExpandedRegistrations(prev => {
      const next = new Set(prev);
      if (next.has(regId)) {
        next.delete(regId);
      } else {
        next.add(regId);
      }
      return next;
    });
  };

  const visitsByRegistration = useMemo(() => {
    const map = new Map<number, Visit[]>();
    for (const visit of visits) {
      const regId = visit.registration_id;
      if (regId) {
        if (!map.has(regId)) map.set(regId, []);
        map.get(regId)!.push(visit);
      }
    }
    return map;
  }, [visits]);

  useEffect(() => {
    setPageTitle("Detail Pasien");
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      const response = await patientsApi.getById(Number(patientId));
      const patientData = response.data;
      setPatient(patientData);
      // Load visits and billings after patient is loaded
      loadVisits(Number(patientId));
      loadRegistrations(Number(patientId));
      loadSeps(Number(patientId));
      loadAdmissionRequests(Number(patientId));
      if (patientData?.no_rm) {
        loadBillings(patientData.no_rm);
      }
    } catch (error) {
      console.error("Error loading patient:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async (patientIdNum: number) => {
    setLoadingVisits(true);
    try {
      const response = await visitsApi.getAll({ patient_id: patientIdNum });
      // Axios returns { data: Visit[] }, so response.data is the array
      const visitsData = response?.data || [];
      setVisits(Array.isArray(visitsData) ? visitsData : []);
    } catch (error) {
      console.error("Error loading visits:", error);
      setVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  const loadBillings = async (noRm: string) => {
    setLoadingBillings(true);
    try {
      // Use no_rm to search for billings
      const response = await billingApi.getAll({ search: noRm, limit: 100 });
      // Response from axios: { data: { data: Billing[], meta: {...} } }
      // billingApi.getAll returns the axios response, so response.data is the backend response body
      const backendResponse = response?.data;
      const billingsData = backendResponse?.data || [];
      setBillings(Array.isArray(billingsData) ? billingsData : []);
    } catch (error) {
      console.error("Error loading billings:", error);
      setBillings([]);
    } finally {
      setLoadingBillings(false);
    }
  };

  const loadRegistrations = async (patientIdNum: number) => {
    setLoadingRegistrations(true);
    try {
      const response = await registrationApi.getAll({ patient_id: patientIdNum, limit: 100 });
      const registrationsData = response?.data?.data || [];
      setRegistrations(Array.isArray(registrationsData) ? registrationsData : []);
    } catch (error) {
      console.error("Error loading registrations:", error);
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const loadSeps = async (patientIdNum: number) => {
    setLoadingSeps(true);
    try {
      const response = await vclaimApi.getSEPList({ patient_id: patientIdNum, limit: 100 });
      const sepsData = response?.data?.data || [];
      setSeps(Array.isArray(sepsData) ? sepsData : []);
    } catch (error) {
      console.error("Error loading SEPs:", error);
      setSeps([]);
    } finally {
      setLoadingSeps(false);
    }
  };

  const loadAdmissionRequests = async (patientIdNum: number) => {
    setLoadingAdmissionRequests(true);
    try {
      const response = await admissionRequestApi.getAll({ patient_id: patientIdNum, limit: 100 });
      const admissionData = response?.data?.data || [];
      setAdmissionRequests(Array.isArray(admissionData) ? admissionData : []);
    } catch (error) {
      console.error("Error loading admission requests:", error);
      setAdmissionRequests([]);
    } finally {
      setLoadingAdmissionRequests(false);
    }
  };

  const handleBack = () => {
    if (query) {
      navigate(`/patient-search?q=${encodeURIComponent(query)}`);
    } else {
      navigate(-1);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd MMMM yyyy", { locale: id });
    } catch {
      return "-";
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "-";
    try {
      const age = differenceInYears(new Date(), parseISO(birthDate));
      return `${age} tahun`;
    } catch {
      return "-";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Aktif":
        return "default";
      case "Tidak Aktif":
        return "secondary";
      case "Meninggal":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getVisitStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "waiting":
      case "in_queue":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getVisitStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Selesai";
      case "in_progress":
        return "Sedang Berlangsung";
      case "waiting":
        return "Menunggu";
      case "in_queue":
        return "Dalam Antrian";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status;
    }
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case "consultation":
        return "Konsultasi";
      case "procedure":
        return "Tindakan";
      case "lab":
        return "Laboratorium";
      case "radiology":
        return "Radiologi";
      case "pharmacy":
        return "Farmasi";
      case "inpatient":
        return "Rawat Inap";
      case "outpatient":
        return "Rawat Jalan";
      case "emergency":
        return "IGD";
      default:
        return type;
    }
  };

  const getBillingStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "partial":
        return "secondary";
      case "pending":
      case "draft":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getBillingStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Lunas";
      case "partial":
        return "Sebagian";
      case "pending":
        return "Menunggu";
      case "draft":
        return "Draft";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status;
    }
  };

  const getRegistrationStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "registered":
      case "in_queue":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getRegistrationStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Selesai";
      case "in_progress":
        return "Sedang Berlangsung";
      case "registered":
        return "Terdaftar";
      case "in_queue":
        return "Dalam Antrian";
      case "cancelled":
        return "Dibatalkan";
      case "scheduled":
        return "Terjadwal";
      case "no_show":
        return "Tidak Hadir";
      default:
        return status;
    }
  };

  const getSepStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "deleted":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getSepStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Aktif";
      case "deleted":
        return "Dihapus";
      default:
        return status;
    }
  };

  const getJenisPelayanan = (jns: string) => {
    return jns === "1" ? "Rawat Inap" : "Rawat Jalan";
  };

  const handleDeleteSep = async () => {
    if (!deleteSepId?.no_sep) return;

    setDeletingSep(true);
    try {
      await api.delete(`/bpjs/vclaim/sep/${deleteSepId.no_sep}`);
      toast({
        title: "Berhasil",
        description: "SEP berhasil dihapus",
      });
      setDeleteSepId(null);
      loadSeps(Number(patientId));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus SEP",
      });
    } finally {
      setDeletingSep(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!patient) return;
    try {
      await printApi.patientLabel(patient.id, 4);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak label pasien",
      });
    }
  };

  const handlePrintInformedConsent = async () => {
    if (!patient) return;
    try {
      await printApi.informedConsent(patient.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak informed consent",
      });
    }
  };

  const handleViewSep = (sep: SEPLocal) => {
    setSelectedSep(sep);
    setSepDetailOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd MMM yyyy HH:mm", { locale: id });
    } catch {
      return "-";
    }
  };

  // Check if patient has allergies
  const hasAllergies =
    patient &&
    (patient.alergi_obat || patient.alergi_makanan || patient.alergi_lainnya);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <User className="h-16 w-16 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold">Pasien Tidak Ditemukan</h2>
        <Button onClick={handleBack}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        {/* Patient Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-full bg-muted flex items-center justify-center">
                {patient.foto ? (
                  <img
                    src={`/${patient.foto}`}
                    alt={patient.nama_lengkap}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">
                  {patient.nama_lengkap} <Badge variant={getStatusVariant(patient.status)} className="text-sm">{patient.status}</Badge>
                </h1>
                <p className="text-sm text-muted-foreground">
                  No. RM:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {patient.no_rm}
                  </span>
                  {" • "}
                  {patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                  {" • "}
                  {calculateAge(patient.tanggal_lahir)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrintLabel}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print Label Pasien</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrintInformedConsent}
                    >
                      <FileCheck className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Informed Consent</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/patients/${patient.id}/edit`)}
                      className="text-white bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Pasien</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {patient.status === "Aktif" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={() => setRegistrationSheetOpen(true)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Daftarkan Pasien</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
        </div>

        <div className="rounded-lg border p-6 space-y-6">
          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={handleTabChange} variant="inline" className="w-full">
            <TabsList>
              <TabsTrigger value="detail">
                <FileText className="mr-2 h-4 w-4" />
                Detail Pasien
              </TabsTrigger>
              <TabsTrigger value="pembayaran">
                <CreditCard className="mr-2 h-4 w-4" />
                Riwayat Pembayaran
              </TabsTrigger>
              <TabsTrigger value="pendaftaran">
                <ClipboardList className="mr-2 h-4 w-4" />
                Riwayat Pendaftaran
              </TabsTrigger>
              <TabsTrigger value="sep">
                <FileCheck className="mr-2 h-4 w-4" />
                Riwayat SEP
              </TabsTrigger>
              <TabsTrigger value="rawat-inap">
                <BedDouble className="mr-2 h-4 w-4" />
                Permintaan Rawat Inap
                {admissionRequests.filter(r => r.status === 'pending').length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {admissionRequests.filter(r => r.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Detail Pasien Tab */}
            <TabsContent value="detail" className="mt-6 space-y-6">
              {/* Allergy Warning */}
              {hasAllergies && (
                <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1">
                        Peringatan Alergi
                      </h4>
                      <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                        {patient.alergi_obat && (
                          <p>
                            <strong>Obat:</strong> {patient.alergi_obat}
                          </p>
                        )}
                        {patient.alergi_makanan && (
                          <p>
                            <strong>Makanan:</strong> {patient.alergi_makanan}
                          </p>
                        )}
                        {patient.alergi_lainnya && (
                          <p>
                            <strong>Lainnya:</strong> {patient.alergi_lainnya}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Identitas Pasien */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <User className="h-4 w-4" />
                      IDENTITAS PASIEN
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          NIK
                        </label>
                        <p className="font-medium text-sm">
                          {patient.nik || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Nama Lengkap
                        </label>
                        <p className="font-medium text-sm">
                          {patient.nama_lengkap}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Tempat, Tanggal Lahir
                        </label>
                        <p className="font-medium text-sm">
                          {patient.tempat_lahir || "-"},{" "}
                          {formatDate(patient.tanggal_lahir)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Umur
                        </label>
                        <p className="font-medium text-sm">
                          {calculateAge(patient.tanggal_lahir)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Jenis Kelamin
                        </label>
                        <p className="font-medium text-sm">
                          {patient.jenis_kelamin === "L"
                            ? "Laki-laki"
                            : "Perempuan"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Golongan Darah
                        </label>
                        <p className="font-medium text-sm">
                          {patient.golongan_darah || "-"} (
                          {patient.rhesus || "-"})
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Agama
                        </label>
                        <p className="font-medium text-sm">
                          {patient.agama || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Pekerjaan
                        </label>
                        <p className="font-medium text-sm">
                          {patient.pekerjaan || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Alamat */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4" />
                      ALAMAT
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold mb-2">
                          Alamat KTP
                        </h4>
                        <p className="text-sm">{patient.alamat_ktp || "-"}</p>
                        <p className="text-sm text-muted-foreground">
                          RT/RW: {patient.rt_ktp || "-"}/{patient.rw_ktp || "-"}
                          , Kel. {patient.kelurahan_ktp || "-"}, Kec.{" "}
                          {patient.kecamatan_ktp || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {patient.kota_ktp || "-"},{" "}
                          {patient.provinsi_ktp || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold mb-2">
                          Alamat Domisili
                        </h4>
                        <p className="text-sm">
                          {patient.alamat_domisili || patient.alamat_ktp || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          RT/RW: {patient.rt_domisili || patient.rt_ktp || "-"}/
                          {patient.rw_domisili || patient.rw_ktp || "-"}, Kel.{" "}
                          {patient.kelurahan_domisili ||
                            patient.kelurahan_ktp ||
                            "-"}
                          , Kec.{" "}
                          {patient.kecamatan_domisili ||
                            patient.kecamatan_ktp ||
                            "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {patient.kota_domisili || patient.kota_ktp || "-"},{" "}
                          {patient.provinsi_domisili ||
                            patient.provinsi_ktp ||
                            "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Kontak */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Phone className="h-4 w-4" />
                      KONTAK
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          No. Telepon
                        </label>
                        <p className="font-medium text-sm">
                          {patient.no_telepon || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          No. HP
                        </label>
                        <p className="font-medium text-sm">
                          {patient.no_hp || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          No. HP Alternatif
                        </label>
                        <p className="font-medium text-sm">
                          {patient.no_hp_alternatif || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Email
                        </label>
                        <p className="font-medium text-sm">
                          {patient.email || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Penanggung Jawab */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4" />
                      PENANGGUNG JAWAB
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Nama
                        </label>
                        <p className="font-medium text-sm">
                          {patient.nama_penanggung_jawab || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Hubungan
                        </label>
                        <p className="font-medium text-sm">
                          {patient.hubungan_penanggung_jawab || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          NIK
                        </label>
                        <p className="font-medium text-sm">
                          {patient.nik_penanggung_jawab || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Telepon
                        </label>
                        <p className="font-medium text-sm">
                          {patient.telepon_penanggung_jawab || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Jaminan Kesehatan */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" />
                      JAMINAN KESEHATAN
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Jenis Jaminan
                        </label>
                        <p className="font-medium text-sm">
                          <Badge variant="outline">
                            {patient.jenis_jaminan}
                          </Badge>
                        </p>
                      </div>
                      {(patient.jenis_jaminan === "BPJS" ||
                        patient.jenis_jaminan === "JKN") && (
                        <>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              No. BPJS
                            </label>
                            <p className="font-medium text-sm">
                              {patient.no_bpjs || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Kelas BPJS
                            </label>
                            <p className="font-medium text-sm">
                              Kelas {patient.kelas_bpjs || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Faskes Tingkat 1
                            </label>
                            <p className="font-medium text-sm">
                              {patient.faskes_tingkat_1 || "-"}
                            </p>
                          </div>
                        </>
                      )}
                      {patient.jenis_jaminan === "Asuransi Swasta" && (
                        <>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Nama Asuransi
                            </label>
                            <p className="font-medium text-sm">
                              {patient.nama_asuransi || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              No. Polis
                            </label>
                            <p className="font-medium text-sm">
                              {patient.no_polis_asuransi || "-"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Riwayat Medis Penting */}
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3 text-red-700 dark:text-red-400">
                      <Heart className="h-4 w-4" />
                      RIWAYAT MEDIS PENTING
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Alergi Obat
                        </label>
                        <p
                          className={`font-medium text-sm ${
                            patient.alergi_obat
                              ? "text-red-600 dark:text-red-400"
                              : ""
                          }`}
                        >
                          {patient.alergi_obat || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Alergi Makanan
                        </label>
                        <p
                          className={`font-medium text-sm ${
                            patient.alergi_makanan
                              ? "text-red-600 dark:text-red-400"
                              : ""
                          }`}
                        >
                          {patient.alergi_makanan || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Alergi Lainnya
                        </label>
                        <p className="font-medium text-sm">
                          {patient.alergi_lainnya || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Penyakit Kronis
                        </label>
                        <p className="font-medium text-sm">
                          {patient.penyakit_kronis || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Riwayat Operasi
                        </label>
                        <p className="font-medium text-sm">
                          {patient.riwayat_operasi || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Obat Rutin
                        </label>
                        <p className="font-medium text-sm">
                          {patient.obat_rutin || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Riwayat Pembayaran Tab */}
            <TabsContent value="pembayaran" className="mt-6">
              {loadingBillings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : billings.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    Riwayat Pembayaran
                  </h3>
                  <p className="text-muted-foreground">
                    Belum ada data riwayat pembayaran untuk pasien ini
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">No. Billing</TableHead>
                      <TableHead className="w-[160px]">Tanggal</TableHead>
                      <TableHead>Metode Bayar</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billings.map((billing) => (
                      <TableRow key={billing.id}>
                        <TableCell className="font-mono font-medium">
                          {billing.billing_number}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(billing.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {billing.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(billing.final_amount)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(billing.paid_amount)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(billing.remaining_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getBillingStatusVariant(billing.status)}
                          >
                            {getBillingStatusLabel(billing.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              navigate(`/billing/${billing.visit_id}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Riwayat Pendaftaran Tab */}
            <TabsContent value="pendaftaran" className="mt-6">
              {loadingRegistrations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : registrations.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    Riwayat Pendaftaran
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Belum ada data riwayat pendaftaran untuk pasien ini
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setRegistrationSheetOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Buat Pendaftaran Baru
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {registrations.map((reg) => {
                    const regId = reg.id || reg.ID;
                    const isExpanded = expandedRegistrations.has(regId!);
                    const regVisits = visitsByRegistration.get(regId!) || [];
                    const mainVisits = regVisits.filter(v =>
                      ['outpatient', 'inpatient', 'emergency', 'consultation'].includes(v.visit_type)
                    );
                    const orderVisits = regVisits.filter(v =>
                      !['outpatient', 'inpatient', 'emergency', 'consultation'].includes(v.visit_type)
                    );

                    return (
                      <div key={regId} className="border rounded-lg overflow-hidden">
                        {/* Registration Header — clickable to expand */}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}
                          onClick={() => toggleRegistrationExpand(regId!)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-mono font-medium text-sm">{reg.registration_number}</span>
                              <span className="text-sm text-muted-foreground">{formatDateTime(reg.created_at)}</span>
                              <span className="text-sm">{reg.destination_room?.name || '-'}</span>
                              <span className="text-sm text-muted-foreground">{reg.doctor?.nama_lengkap || reg.doctor?.name || '-'}</span>
                              <Badge variant="outline" className="uppercase text-xs">{reg.payment_method}</Badge>
                              {reg.sep_number && (
                                <span className="font-mono text-xs text-muted-foreground">SEP: {reg.sep_number}</span>
                              )}
                              <Badge variant={getRegistrationStatusVariant(reg.status)} className="text-xs">
                                {getRegistrationStatusLabel(reg.status)}
                              </Badge>
                            </div>
                            {regVisits.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {mainVisits.length > 0 && `${mainVisits.length} kunjungan utama`}
                                {mainVisits.length > 0 && orderVisits.length > 0 && ' · '}
                                {orderVisits.length > 0 && `${orderVisits.length} order`}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Visit Tree */}
                        {isExpanded && (
                          <div className="border-t bg-muted/10 px-4 py-3">
                            {loadingVisits ? (
                              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memuat kunjungan...
                              </div>
                            ) : regVisits.length === 0 ? (
                              <div className="text-sm text-muted-foreground py-2 pl-4">
                                Belum ada kunjungan untuk pendaftaran ini
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* Section: Kunjungan Utama */}
                                {mainVisits.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 pl-1">
                                      Kunjungan Utama
                                    </div>
                                    {mainVisits.map((visit, idx) => {
                                      const isLastMain = idx === mainVisits.length - 1 && orderVisits.length === 0;
                                      return (
                                        <div key={visit.id} className="flex items-center gap-2.5 py-1.5 pl-5 relative group hover:bg-muted/50 rounded-sm">
                                          <div className={`absolute left-[7px] w-px bg-border ${isLastMain ? 'top-0 h-1/2' : 'top-0 bottom-0'}`} />
                                          <div className="absolute left-[7px] top-1/2 w-3 h-px bg-border" />
                                          <div className="relative z-10 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                          <Badge variant="outline" className={`text-xs shrink-0 ${
                                            visit.visit_type === 'emergency' ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30' :
                                            visit.visit_type === 'inpatient' ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' :
                                            visit.visit_type === 'outpatient' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30' :
                                            'border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30'
                                          }`}>
                                            {getVisitTypeLabel(visit.visit_type)}
                                          </Badge>
                                          <span className="text-sm truncate">{visit.room?.name || '-'}</span>
                                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                                            {visit.doctor?.user?.name || visit.doctor?.name || ''}
                                          </span>
                                          <Badge variant={getVisitStatusVariant(visit.status)} className="text-xs shrink-0">
                                            {getVisitStatusLabel(visit.status)}
                                          </Badge>
                                          {/* Action buttons */}
                                          <div className="ml-auto flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TooltipProvider delayDuration={200}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => navigate(`/visits/${visit.id}`)}
                                                  >
                                                    <Eye className="h-3.5 w-3.5" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Lihat Kunjungan</p></TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => { if (regId) printApi.admissionDischargeSummary(regId, visit.id); }}
                                                  >
                                                    <FileText className="h-3.5 w-3.5" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>MR.1 Ringkasan Masuk & Keluar</p></TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => printApi.dpjpRequest(visit.id)}
                                                  >
                                                    <UserCheck className="h-3.5 w-3.5" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Permohonan DPJP</p></TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => printApi.informedConsentReceipt(visit.id)}
                                                  >
                                                    <FileSignature className="h-3.5 w-3.5" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Bukti Informed Consent</p></TooltipContent>
                                              </Tooltip>
                                              {visit.visit_type === 'outpatient' && (
                                                <>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={() => printApi.outpatientResume(visit.id)}
                                                      >
                                                        <ClipboardList className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top"><p>Cetak Resume Rawat Jalan</p></TooltipContent>
                                                  </Tooltip>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={handlePrintLabel}
                                                      >
                                                        <Printer className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top"><p>Cetak Label Pasien</p></TooltipContent>
                                                  </Tooltip>
                                                </>
                                              )}
                                              {visit.visit_type === 'emergency' && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                      onClick={() => printApi.emergencySummary(visit.id)}
                                                    >
                                                      <ClipboardList className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top"><p>Cetak Resume IGD</p></TooltipContent>
                                                </Tooltip>
                                              )}
                                              {visit.visit_type === 'inpatient' && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                      onClick={() => printApi.inpatientResume(visit.id)}
                                                    >
                                                      <ClipboardList className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top"><p>Cetak Resume Rawat Inap</p></TooltipContent>
                                                </Tooltip>
                                              )}
                                              {visit.room_queue?.id && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                      onClick={() => printApi.queueTicket(visit.room_queue.id)}
                                                    >
                                                      <Clock className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top"><p>Cetak Tiket Antrian</p></TooltipContent>
                                                </Tooltip>
                                              )}
                                            </TooltipProvider>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Section: Order / Penunjang */}
                                {orderVisits.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 pl-1">
                                      Order / Penunjang
                                    </div>
                                    {orderVisits.map((visit, idx) => {
                                      const isLastOrder = idx === orderVisits.length - 1;
                                      return (
                                        <div key={visit.id} className="flex items-center gap-2.5 py-1.5 pl-5 relative group hover:bg-muted/50 rounded-sm">
                                          <div className={`absolute left-[7px] w-px bg-border ${isLastOrder ? 'top-0 h-1/2' : 'top-0 bottom-0'}`} />
                                          <div className="absolute left-[7px] top-1/2 w-3 h-px bg-border" />
                                          <div className="relative z-10 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                                          <Badge variant="outline" className={`text-xs shrink-0 ${
                                            visit.visit_type === 'pharmacy' ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' :
                                            visit.visit_type === 'lab' ? 'border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30' :
                                            visit.visit_type === 'radiology' ? 'border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' :
                                            'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30'
                                          }`}>
                                            {getVisitTypeLabel(visit.visit_type)}
                                          </Badge>
                                          <span className="text-sm truncate">{visit.room?.name || '-'}</span>
                                          <Badge variant={getVisitStatusVariant(visit.status)} className="text-xs shrink-0">
                                            {getVisitStatusLabel(visit.status)}
                                          </Badge>
                                          {/* Action buttons */}
                                          <div className="ml-auto flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TooltipProvider delayDuration={200}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => navigate(`/visits/${visit.id}`)}
                                                  >
                                                    <Eye className="h-3.5 w-3.5" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Lihat Kunjungan</p></TooltipContent>
                                              </Tooltip>
                                              {visit.room_queue?.id && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                      onClick={() => printApi.queueTicket(visit.room_queue.id)}
                                                    >
                                                      <Clock className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top"><p>Cetak Tiket Antrian</p></TooltipContent>
                                                </Tooltip>
                                              )}
                                            </TooltipProvider>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Riwayat SEP Tab */}
            <TabsContent value="sep" className="mt-6">
              {loadingSeps ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : seps.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    Riwayat SEP
                  </h3>
                  <p className="text-muted-foreground">
                    Belum ada data SEP untuk pasien ini
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">No. SEP</TableHead>
                      <TableHead className="w-[120px]">Tgl SEP</TableHead>
                      <TableHead className="w-[100px]">Jns Pelayanan</TableHead>
                      <TableHead>Poli</TableHead>
                      <TableHead>Dokter DPJP</TableHead>
                      <TableHead>Diagnosa</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seps.map((sep) => (
                      <TableRow key={sep.id}>
                        <TableCell className="font-mono font-medium">
                          {sep.no_sep}
                        </TableCell>
                        <TableCell>
                          {sep.tgl_sep ? new Date(sep.tgl_sep).toLocaleDateString("id-ID") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getJenisPelayanan(sep.jns_pelayanan)}
                          </Badge>
                        </TableCell>
                        <TableCell>{sep.nama_poli || "-"}</TableCell>
                        <TableCell>{sep.nama_dpjp || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={sep.nama_diagnosa}>
                          {sep.nama_diagnosa || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSepStatusVariant(sep.status)}>
                            {getSepStatusLabel(sep.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleViewSep(sep)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                              </DropdownMenuItem>
                              {sep.status === "active" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteSepId(sep)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus SEP
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Permintaan Rawat Inap Tab */}
            <TabsContent value="rawat-inap" className="mt-6">
              {loadingAdmissionRequests ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : admissionRequests.length === 0 ? (
                <div className="text-center py-12">
                  <BedDouble className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    Permintaan Rawat Inap
                  </h3>
                  <p className="text-muted-foreground">
                    Belum ada permintaan rawat inap untuk pasien ini
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">No. Request</TableHead>
                      <TableHead className="w-[120px]">Prioritas</TableHead>
                      <TableHead className="w-[100px]">Tipe</TableHead>
                      <TableHead>Asal Unit</TableHead>
                      <TableHead>Kelas Pilihan</TableHead>
                      <TableHead className="w-[160px]">Tanggal Request</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissionRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono font-medium">
                          {request.request_number}
                        </TableCell>
                        <TableCell>
                          {request.priority === "emergency" ? (
                            <Badge variant="destructive">Emergency</Badge>
                          ) : request.priority === "urgent" ? (
                            <Badge className="bg-orange-500 hover:bg-orange-600">Urgent</Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {request.admission_type}
                        </TableCell>
                        <TableCell>
                          {request.source_visit?.id ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto font-normal"
                              onClick={() => navigate(`/visits/${request.source_visit?.id}`)}
                            >
                              {request.source_visit?.room?.name || 'N/A'}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          ) : (
                            <span>{request.source_visit?.room?.name || 'N/A'}</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {request.preferred_class?.replace(/_/g, ' ') || '-'}
                        </TableCell>
                        <TableCell>
                          {request.requested_at
                            ? formatDateTime(request.requested_at)
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {request.status === "pending" ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                              <Clock className="h-3 w-3 mr-1" /> Menunggu
                            </Badge>
                          ) : request.status === "approved" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" /> Disetujui
                            </Badge>
                          ) : request.status === "rejected" ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" /> Ditolak
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                              Dibatalkan
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {request.status === "pending" ? (
                            <Button size="sm" onClick={() => navigate(`/admisi/${request.id}`)}>
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Proses
                            </Button>
                          ) : request.inpatient_visit_id ? (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/visits/${request.inpatient_visit_id}`)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Lihat
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/admisi/${request.id}`)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Detail
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete SEP Dialog */}
      <AlertDialog open={!!deleteSepId} onOpenChange={(open) => !open && setDeleteSepId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEP</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus SEP <strong>{deleteSepId?.no_sep}</strong>?
              <br />
              Tindakan ini akan menghapus data SEP dari BPJS dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSep}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSep}
              disabled={deletingSep}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSep ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus SEP"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Registration Sheet */}
      {patient && (
        <RegistrationSheet
          open={registrationSheetOpen}
          onOpenChange={setRegistrationSheetOpen}
          patient={patient}
          onSuccess={() => {
            // Reload data after registration
            loadVisits(Number(patientId));
            loadRegistrations(Number(patientId));
            loadSeps(Number(patientId));
          }}
          onSEPCreated={() => loadSeps(Number(patientId))}
        />
      )}

      {/* SEP Detail Sheet */}
      <SEPDetailSheet
        open={sepDetailOpen}
        onOpenChange={setSepDetailOpen}
        sep={selectedSep}
        onUpdate={() => loadSeps(Number(patientId))}
        onDelete={() => loadSeps(Number(patientId))}
      />
    </div>
  );
}

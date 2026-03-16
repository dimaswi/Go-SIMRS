import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Activity,
  Smartphone,
  CheckCircle,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatPatientName } from "@/lib/print-utils";
import {
  registrationStatusLabels,
  paymentMethodLabels,
  registrationTypeLabels,
} from "@/lib/api/queue";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { vclaimApi, type VClaimSEP } from "@/lib/api/vclaim";
import { Search } from "lucide-react";

interface SEPLocal {
  id: number;
  no_sep: string;
  no_kartu: string;
  nama_pasien: string;
  tgl_sep: string;
  jns_pelayanan: string;
  kls_rawat_hak: string;
  no_mr: string;
  asal_rujukan: string;
  no_rujukan: string;
  tgl_rujukan: string;
  ppk_rujukan: string;
  nama_rujukan: string;
  kode_poli: string;
  nama_poli: string;
  kode_dpjp: string;
  nama_dpjp: string;
  diag_awal: string;
  nama_diagnosa: string;
  catatan: string;
  status: string;
}

interface SPRILocal {
  id: number;
  no_spri: string;
  registration_id?: number;
  patient_id: number;
  visit_id?: number;
  no_kartu: string;
  nama: string;
  kelamin: string;
  tgl_lahir: string;
  tgl_rencana_kontrol: string;
  kode_poli: string;
  nama_poli: string;
  kode_dokter: string;
  nama_dokter: string;
  nama_diagnosa: string;
  user_buat: string;
  status: string; // active, used, cancelled
}

export default function RegistrationShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [bpjsQueue, setBpjsQueue] = useState<BPJSQueue | null>(null);
  const [sepData, setSepData] = useState<SEPLocal | null>(null);
  const [spriData, setSpriData] = useState<SPRILocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activatingCheckin, setActivatingCheckin] = useState(false);
  const [deletingSEP, setDeletingSEP] = useState(false);
  const [editSEPOpen, setEditSEPOpen] = useState(false);
  const [deleteSEPOpen, setDeleteSEPOpen] = useState(false);
  const [updatingSEP, setUpdatingSEP] = useState(false);
  const [deleteSPRIOpen, setDeleteSPRIOpen] = useState(false);
  const [deletingSPRI, setDeletingSPRI] = useState(false);

  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_method: "cash" as string,
    bpjs_number: "",
    insurance_name: "",
    insurance_number: "",
  });
  // SEP lookup states
  const [sepInputNumber, setSepInputNumber] = useState("");
  const [searchingSEP, setSearchingSEP] = useState(false);
  const [foundSEP, setFoundSEP] = useState<VClaimSEP | null>(null);
  const [sepSearchError, setSepSearchError] = useState("");
  const [savingSEP, setSavingSEP] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");
  const [sepEditForm, setSepEditForm] = useState({
    catatan: "",
    diag_awal: "",
    kls_rawat_naik: "",
    pembiayaan: "",
    penanggung_jawab: "",
    no_telp: "",
  });

  useEffect(() => {
    setPageTitle("Detail Pendaftaran");
    loadRegistration();
  }, [id]);

  const loadRegistration = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await registrationApi.getById(parseInt(id));
      const regData = response.data.data;
      setRegistration(regData);

      // Try to load BPJS Queue if payment method is BPJS
      if (regData.payment_method === 'bpjs') {
        try {
          const bpjsResponse = await bpjsApi.getQueueByRegistration(parseInt(id));
          setBpjsQueue(bpjsResponse.data.data);
        } catch {
          // No BPJS queue found, that's okay
          setBpjsQueue(null);
        }

        // Load SEP data - first try by registration, then by sep_number
        try {
          const sepResponse = await api.get(`/bpjs/vclaim/sep/registration/${id}`);
          if (sepResponse.data.data) {
            setSepData(sepResponse.data.data);
          }
        } catch {
          setSepData(null);
        }

        // Load SPRI data
        try {
          const spriResponse = await api.get(`/bpjs/vclaim/spri/registration/${id}`);
          if (spriResponse.data.data) {
            setSpriData(spriResponse.data.data);
          }
        } catch {
          setSpriData(null);
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data pendaftaran",
      });
      navigate("/registrations");
    } finally {
      setLoading(false);
    }
  };

  // const handleOpenEditPayment = () => {
  //   if (registration) {
  //     setPaymentForm({
  //       payment_method: registration.payment_method || "cash",
  //       bpjs_number: registration.bpjs_number || registration.patient?.no_bpjs || "",
  //       insurance_name: registration.insurance_name || "",
  //       insurance_number: registration.insurance_number || "",
  //     });
  //     // Reset SEP lookup states
  //     setSepInputNumber("");
  //     setFoundSEP(null);
  //     setSepSearchError("");
  //     setSelectedVisitId("");
  //     setEditPaymentOpen(true);
  //   }
  // };

  const handleSearchSEP = async () => {
    if (!sepInputNumber.trim()) return;

    setSearchingSEP(true);
    setSepSearchError("");
    setFoundSEP(null);
    try {
      const response = await vclaimApi.getSEP(sepInputNumber.trim());
      if (response.data.data) {
        setFoundSEP(response.data.data);
      } else {
        setSepSearchError("SEP tidak ditemukan");
      }
    } catch (error: any) {
      setSepSearchError(error.response?.data?.error || "Gagal mencari SEP");
    } finally {
      setSearchingSEP(false);
    }
  };

  const handleSaveSEP = async () => {
    if (!foundSEP || !registration || !id) return;

    setSavingSEP(true);
    try {
      const patientId = registration.patient?.ID || registration.patient?.id || 0;
      const visitId = selectedVisitId && selectedVisitId !== "none" ? parseInt(selectedVisitId) : undefined;

      // Import SEP ke database lokal
      await api.post("/bpjs/vclaim/sep/import", {
        no_sep: foundSEP.noSep,
        no_kartu: foundSEP.peserta?.noKartu || "",
        nama_pasien: foundSEP.peserta?.nama || "",
        nik: foundSEP.peserta?.nik || "",
        tgl_lahir: foundSEP.peserta?.tglLahir || "",
        jenis_kelamin: foundSEP.peserta?.jnsKelamin || "",
        tgl_sep: foundSEP.tglSep || "",
        jns_pelayanan: foundSEP.jnsPelayanan || "",
        kls_rawat_hak: foundSEP.peserta?.klsRawat?.klsRawatHak || "",
        no_mr: foundSEP.peserta?.noMr || "",
        kode_poli: foundSEP.poli || "",
        nama_poli: foundSEP.poli || "",
        diag_awal: foundSEP.diagnosa || "",
        nama_diagnosa: foundSEP.diagnosa || "",
        catatan: foundSEP.catatan || "",
        patient_id: patientId,
        registration_id: parseInt(id),
        visit_id: visitId,
      });

      toast({
        title: "Berhasil",
        description: "SEP berhasil disimpan dan di-assign ke pendaftaran",
      });

      // Reset and close
      setFoundSEP(null);
      setSepInputNumber("");
      setSelectedVisitId("");
      setEditPaymentOpen(false);
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan SEP",
      });
    } finally {
      setSavingSEP(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!id) return;

    setUpdatingPayment(true);
    try {
      await registrationApi.update(parseInt(id), {
        payment_method: paymentForm.payment_method,
        bpjs_number: paymentForm.payment_method === "bpjs" ? paymentForm.bpjs_number : undefined,
        insurance_name: paymentForm.payment_method === "insurance" ? paymentForm.insurance_name : undefined,
        insurance_number: paymentForm.payment_method === "insurance" ? paymentForm.insurance_number : undefined,
      });
      toast({
        title: "Berhasil",
        description: "Metode pembayaran berhasil diubah",
      });
      setEditPaymentOpen(false);
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengubah metode pembayaran",
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleOpenEditSEP = () => {
    if (sepData) {
      setSepEditForm({
        catatan: sepData.catatan || "",
        diag_awal: sepData.diag_awal || "",
        kls_rawat_naik: "",
        pembiayaan: "",
        penanggung_jawab: "",
        no_telp: "",
      });
      setEditSEPOpen(true);
    }
  };

  const handleUpdateSEP = async () => {
    if (!sepData?.no_sep) return;

    setUpdatingSEP(true);
    try {
      await api.put(`/bpjs/vclaim/sep/${sepData.no_sep}`, {
        no_sep: sepData.no_sep,
        kls_rawat_hak: sepData.kls_rawat_hak,
        kls_rawat_naik: sepEditForm.kls_rawat_naik === "none" ? "" : sepEditForm.kls_rawat_naik,
        pembiayaan: sepEditForm.pembiayaan === "none" ? "" : sepEditForm.pembiayaan,
        penanggung_jawab: sepEditForm.penanggung_jawab,
        no_mr: sepData.no_mr,
        catatan: sepEditForm.catatan,
        diag_awal: sepEditForm.diag_awal,
        poli_tujuan: sepData.kode_poli,
        dpjp_layan: sepData.kode_dpjp,
        no_telp: sepEditForm.no_telp,
      });
      toast({
        title: "Berhasil",
        description: "SEP berhasil diupdate",
      });
      setEditSEPOpen(false);
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengupdate SEP",
      });
    } finally {
      setUpdatingSEP(false);
    }
  };

  const handleDeleteSEP = async () => {
    if (!sepData?.no_sep) return;

    setDeletingSEP(true);
    try {
      await api.delete(`/bpjs/vclaim/sep/${sepData.no_sep}`);
      toast({
        title: "Berhasil",
        description: "SEP berhasil dihapus",
      });
      setSepData(null);
      setDeleteSEPOpen(false);
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus SEP",
      });
    } finally {
      setDeletingSEP(false);
    }
  };

  const handleActivateCheckin = async () => {
    if (!bpjsQueue) return;
    
    setActivatingCheckin(true);
    try {
      const response = await bpjsApi.activateQueueCheckin(bpjsQueue.id);
      toast({
        title: "Berhasil",
        description: response.data.message,
      });
      // Reload data
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengaktifkan check-in",
      });
    } finally {
      setActivatingCheckin(false);
    }
  };

  const handleDeleteSPRI = async () => {
    if (!spriData?.no_spri) return;
    setDeletingSPRI(true);
    try {
      await api.delete(`/bpjs/vclaim/spri/${spriData.no_spri}`);
      toast({ title: "Berhasil", description: "SPRI berhasil dihapus dari BPJS" });
      setDeleteSPRIOpen(false);
      setSpriData(null);
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus SPRI dari BPJS",
      });
    } finally {
      setDeletingSPRI(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return null;
  }

  const statusColors: Record<string, string> = {
    registered: "default",
    in_queue: "secondary",
    in_progress: "outline",
    completed: "default",
    cancelled: "destructive",
  };

  const getStatusVariant = (status: string) => {
    return statusColors[status] || "outline";
  };

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {formatPatientName(registration.patient?.nama_lengkap || registration.patient?.name, registration.patient?.jenis_kelamin, undefined, registration.patient?.tanggal_lahir) || "-"}
            </h1>
            <p className="text-sm text-muted-foreground">
              No. RM: {registration.patient?.no_rm || registration.patient?.medical_record_number || "-"} â€¢ 
              No. Pendaftaran: {registration.registration_number}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bpjsQueue && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              MJKN
            </Badge>
          )}
          <Badge variant={getStatusVariant(registration.status) as any}>
            {registrationStatusLabels[registration.status]}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border p-6">
          {/* Informasi Pasien */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              INFORMASI PASIEN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">{formatPatientName(registration.patient?.nama_lengkap || registration.patient?.name, registration.patient?.jenis_kelamin, undefined, registration.patient?.tanggal_lahir) || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. Rekam Medis</label>
                <p className="font-medium text-sm font-mono">{registration.patient?.no_rm || registration.patient?.medical_record_number || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm font-mono">{registration.patient?.nik || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                <p className="font-medium text-sm">
                  {(registration.patient?.jenis_kelamin || registration.patient?.gender) === "L" ? "Laki-laki" : "Perempuan"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Lahir</label>
                <p className="font-medium text-sm">
                  {(registration.patient?.tanggal_lahir || registration.patient?.date_of_birth)
                    ? format(new Date(registration.patient.tanggal_lahir || registration.patient.date_of_birth!), "dd MMMM yyyy", {
                        locale: localeId,
                      })
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Pendaftaran */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              INFORMASI PENDAFTARAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nomor Pendaftaran</label>
                <p className="font-medium text-sm font-mono">{registration.registration_number}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Pendaftaran</label>
                <p className="font-medium text-sm">
                  {format(new Date(registration.registration_date), "dd MMMM yyyy HH:mm", { locale: localeId })}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Pendaftaran</label>
                <p className="font-medium text-sm">{registrationTypeLabels[registration.registration_type]}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Didaftarkan Oleh</label>
                <p className="font-medium text-sm">{registration.registered_by?.full_name || registration.registered_by?.name || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={getStatusVariant(registration.status) as any}>
                    {registrationStatusLabels[registration.status]}
                  </Badge>
                </div>
              </div>
              {registration.queue?.queue_number && (
                <div>
                  <label className="text-xs text-muted-foreground">Nomor Antrian Loket</label>
                  <p className="font-medium text-sm">{registration.queue.queue_number}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Layanan */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              INFORMASI LAYANAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Poli/Ruangan Tujuan</label>
                {registration.destination_room ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-primary hover:underline"
                    onClick={() => navigate(`/rooms/show/${registration.destination_room?.id || registration.destination_room?.ID}`)}
                  >
                    {registration.destination_room.name}
                  </Button>
                ) : (
                  <p className="font-medium text-sm">-</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kode Ruangan</label>
                <p className="font-medium text-sm font-mono">{registration.destination_room?.code || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dokter</label>
                <p className="font-medium text-sm">{registration.doctor?.nama_lengkap || registration.doctor?.nama || registration.doctor?.name || "-"}</p>
                {(registration.doctor?.spesialisasi || registration.doctor?.specialization) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {registration.doctor.spesialisasi || registration.doctor.specialization}
                  </p>
                )}
              </div>
              {registration.visit?.room_queue && (
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs text-muted-foreground">Nomor Antrian Ruangan</label>
                  <p className="font-mono font-bold text-2xl text-primary mt-1">
                    {registration.visit.room_queue.queue_number}
                  </p>
                  <Badge className="mt-1" variant="outline">
                    {registration.visit.room_queue.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Pembayaran */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              INFORMASI PEMBAYARAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Metode Pembayaran</label>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={registration.payment_method === "cash" ? "default" : "secondary"}>
                    {paymentMethodLabels[registration.payment_method]}
                  </Badge>
                </div>
              </div>
              {registration.payment_method === "bpjs" && registration.bpjs_number && (
                <div>
                  <label className="text-xs text-muted-foreground">Nomor BPJS</label>
                  <p className="font-medium text-sm font-mono">{registration.bpjs_number}</p>
                </div>
              )}
              {registration.payment_method === "insurance" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Nama Asuransi</label>
                    <p className="font-medium text-sm">{registration.insurance_name || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Polis</label>
                    <p className="font-medium text-sm font-mono">{registration.insurance_number || "-"}</p>
                  </div>
                </>
              )}
              
              {/* SEP Info - inline with payment */}
              {registration.payment_method === "bpjs" && sepData && (
                <div className="col-span-2 lg:col-span-4">
                  <div className="mt-2 p-3 rounded-lg border bg-blue-50/50 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">No. SEP:</span>
                            <span className="font-mono font-bold text-blue-700">{sepData.no_sep}</span>
                            <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                              {sepData.status === 'active' ? 'Aktif' : sepData.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Poli: <strong className="text-foreground">{sepData.nama_poli || sepData.kode_poli}</strong></span>
                            <span>DPJP: <strong className="text-foreground">{sepData.nama_dpjp || sepData.kode_dpjp}</strong></span>
                            <span>Diagnosa: <strong className="text-foreground">{sepData.nama_diagnosa || sepData.diag_awal}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                onClick={handleOpenEditSEP}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit SEP</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-100"
                                disabled={deletingSEP}
                                onClick={() => setDeleteSEPOpen(true)}
                              >
                                {deletingSEP ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus SEP</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informasi SPRI (Surat Perintah Rawat Inap) */}
          {registration.payment_method === "bpjs" && spriData && (
            <>
              <div className="border-t my-6" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  SPRI (SURAT PERINTAH RAWAT INAP)
                  <Badge
                    variant="outline"
                    className={
                      spriData.status === "active"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : spriData.status === "cancelled"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                    }
                  >
                    {spriData.status === "active" ? "Aktif" : spriData.status === "cancelled" ? "Dibatalkan" : spriData.status}
                  </Badge>
                </h3>
                <div className="p-4 rounded-lg border bg-green-50/40 border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                      <div>
                        <label className="text-xs text-muted-foreground">Nomor SPRI</label>
                        <p className="font-medium text-sm font-mono text-green-700">{spriData.no_spri}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Tgl Rencana Kontrol</label>
                        <p className="font-medium text-sm">
                          {spriData.tgl_rencana_kontrol
                            ? format(new Date(spriData.tgl_rencana_kontrol), "dd MMMM yyyy", { locale: localeId })
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Poli Kontrol</label>
                        <p className="font-medium text-sm">{spriData.nama_poli || spriData.kode_poli || "-"}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Dokter DPJP</label>
                        <p className="font-medium text-sm">{spriData.nama_dokter || spriData.kode_dokter || "-"}</p>
                      </div>
                      {spriData.nama_diagnosa && (
                        <div>
                          <label className="text-xs text-muted-foreground">Diagnosa</label>
                          <p className="font-medium text-sm">{spriData.nama_diagnosa}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground">Dibuat Oleh</label>
                        <p className="font-medium text-sm">{spriData.user_buat || "-"}</p>
                      </div>
                    </div>
                    {spriData.status === "active" && (
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-100"
                                disabled={deletingSPRI}
                                onClick={() => setDeleteSPRIOpen(true)}
                              >
                                {deletingSPRI ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus SPRI dari BPJS</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Informasi BPJS/MJKN */}
          {bpjsQueue && (
            <>
              <div className="border-t my-6" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  INFORMASI ANTRIAN BPJS (MJKN)
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    MJKN
                  </Badge>
                </h3>
                
                {/* Status & Action */}
                <div className="mb-4 p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        bpjsQueue.status === 'booking' ? 'bg-yellow-100' :
                        bpjsQueue.status === 'checkin' ? 'bg-green-100' :
                        bpjsQueue.status === 'batal' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {bpjsQueue.status === 'booking' && <Clock className="h-5 w-5 text-yellow-600" />}
                        {bpjsQueue.status === 'checkin' && <CheckCircle className="h-5 w-5 text-green-600" />}
                        {bpjsQueue.status === 'batal' && <AlertCircle className="h-5 w-5 text-red-600" />}
                        {!['booking', 'checkin', 'batal'].includes(bpjsQueue.status) && <Smartphone className="h-5 w-5 text-blue-600" />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {bpjsQueue.status === 'booking' && 'Menunggu Check-in'}
                          {bpjsQueue.status === 'checkin' && 'Sudah Check-in'}
                          {bpjsQueue.status === 'dipanggil' && 'Dipanggil'}
                          {bpjsQueue.status === 'dilayani' && 'Sedang Dilayani'}
                          {bpjsQueue.status === 'selesai' && 'Selesai'}
                          {bpjsQueue.status === 'batal' && 'Dibatalkan'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bpjsQueue.status === 'booking' 
                            ? 'Pasien sudah booking via MJKN, silakan aktivasi check-in saat pasien datang'
                            : bpjsQueue.waktu_checkin 
                              ? `Check-in: ${format(new Date(bpjsQueue.waktu_checkin), "dd MMM yyyy HH:mm", { locale: localeId })}`
                              : ''
                          }
                        </p>
                      </div>
                    </div>
                    {bpjsQueue.status === 'booking' && (
                      <Button 
                        onClick={handleActivateCheckin}
                        disabled={activatingCheckin}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {activatingCheckin ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Aktivasi Check-in
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="text-xs text-muted-foreground">Kode Booking</label>
                    <p className="font-medium text-sm font-mono">{bpjsQueue.kode_booking}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Antrian MJKN</label>
                    <p className="font-mono font-bold text-2xl text-primary">{bpjsQueue.nomor_antrean}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tanggal Periksa</label>
                    <p className="font-medium text-sm">
                      {format(new Date(bpjsQueue.tanggal_periksa), "dd MMMM yyyy", { locale: localeId })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jam Praktek</label>
                    <p className="font-medium text-sm">{bpjsQueue.jam_praktek}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Poli BPJS</label>
                    <p className="font-medium text-sm">{bpjsQueue.nama_poli}</p>
                    <p className="text-xs text-muted-foreground">{bpjsQueue.kode_poli}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Dokter BPJS</label>
                    <p className="font-medium text-sm">{bpjsQueue.nama_dokter}</p>
                    <p className="text-xs text-muted-foreground">{bpjsQueue.kode_dokter}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Kartu BPJS</label>
                    <p className="font-medium text-sm font-mono">{bpjsQueue.no_kartu}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jenis Kunjungan</label>
                    <p className="font-medium text-sm">
                      {bpjsQueue.jenis_kunjungan === 1 && "Rujukan FKTP"}
                      {bpjsQueue.jenis_kunjungan === 2 && "Rujukan Internal"}
                      {bpjsQueue.jenis_kunjungan === 3 && "Kontrol"}
                      {bpjsQueue.jenis_kunjungan === 4 && "Rujukan Antar RS"}
                    </p>
                  </div>
                  {bpjsQueue.nomor_referensi && (
                    <div>
                      <label className="text-xs text-muted-foreground">Nomor Referensi/Rujukan</label>
                      <p className="font-medium text-sm font-mono">{bpjsQueue.nomor_referensi}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">Estimasi Dilayani</label>
                    <p className="font-medium text-sm">
                      {format(new Date(bpjsQueue.estimasi_dilayani), "HH:mm", { locale: localeId })}
                    </p>
                  </div>
                </div>

                {/* Task Tracking */}
                <div className="mt-4 pt-4 border-t">
                  <label className="text-xs text-muted-foreground mb-2 block">Progress Task BPJS</label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={bpjsQueue.task3_at ? "default" : "outline"} className={bpjsQueue.task3_at ? "bg-green-600" : ""}>
                      Task 3: Tunggu Poli {bpjsQueue.task3_at && "âœ“"}
                    </Badge>
                    <Badge variant={bpjsQueue.task4_at ? "default" : "outline"} className={bpjsQueue.task4_at ? "bg-green-600" : ""}>
                      Task 4: Dipanggil {bpjsQueue.task4_at && "âœ“"}
                    </Badge>
                    <Badge variant={bpjsQueue.task5_at ? "default" : "outline"} className={bpjsQueue.task5_at ? "bg-green-600" : ""}>
                      Task 5: Selesai {bpjsQueue.task5_at && "âœ“"}
                    </Badge>
                    <Badge variant={bpjsQueue.task6_at ? "default" : "outline"} className={bpjsQueue.task6_at ? "bg-green-600" : ""}>
                      Task 6: Tunggu Farmasi {bpjsQueue.task6_at && "âœ“"}
                    </Badge>
                    <Badge variant={bpjsQueue.task7_at ? "default" : "outline"} className={bpjsQueue.task7_at ? "bg-green-600" : ""}>
                      Task 7: Serah Obat {bpjsQueue.task7_at && "âœ“"}
                    </Badge>
                  </div>
                </div>

                {/* Sync Status */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Status Sinkronisasi:</label>
                    <Badge variant={bpjsQueue.sync_status === 'success' ? "default" : bpjsQueue.sync_status === 'failed' ? "destructive" : "secondary"}>
                      {bpjsQueue.sync_status}
                    </Badge>
                    {bpjsQueue.last_sync_at && (
                      <span className="text-xs text-muted-foreground">
                        (Terakhir: {format(new Date(bpjsQueue.last_sync_at), "dd/MM HH:mm")})
                      </span>
                    )}
                  </div>
                  {bpjsQueue.sync_error && (
                    <p className="text-xs text-red-500 mt-1">{bpjsQueue.sync_error}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {(registration.complaint || registration.notes || registration.visit) && (
            <>
              <div className="border-t my-6" />

              {/* Informasi Tambahan */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  INFORMASI TAMBAHAN
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {registration.complaint && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Keluhan</label>
                      <p className="font-medium text-sm">{registration.complaint}</p>
                    </div>
                  )}
                  {registration.notes && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Catatan</label>
                      <p className="font-medium text-sm">{registration.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {registration.visit && (
            <>
              <div className="border-t my-6" />

              {/* Informasi Kunjungan */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  INFORMASI KUNJUNGAN
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Kunjungan</label>
                    <p className="font-medium text-sm font-mono">{registration.visit.visit_number}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jenis Kunjungan</label>
                    <p className="font-medium text-sm capitalize">{registration.visit.visit_type}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status Kunjungan</label>
                    <div className="mt-1">
                      <Badge variant="outline">{registration.visit.status}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
      </div>

      {/* Modal Edit SEP */}
      <Dialog open={editSEPOpen} onOpenChange={setEditSEPOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit SEP
            </DialogTitle>
            <DialogDescription>
              Update data SEP dengan nomor <strong className="font-mono">{sepData?.no_sep}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Info SEP (readonly) */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs text-muted-foreground">No. Kartu BPJS</Label>
                <p className="font-mono text-sm">{sepData?.no_kartu}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nama Pasien</Label>
                <p className="text-sm font-medium">{sepData?.nama_pasien}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Poli Tujuan</Label>
                <p className="text-sm">{sepData?.nama_poli || sepData?.kode_poli}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">DPJP</Label>
                <p className="text-sm">{sepData?.nama_dpjp || sepData?.kode_dpjp}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="diag_awal">Diagnosa Awal</Label>
                  <Input
                    id="diag_awal"
                    placeholder="Kode ICD-10"
                    value={sepEditForm.diag_awal}
                    onChange={(e) => setSepEditForm(prev => ({ ...prev, diag_awal: e.target.value }))}
                  />
                  {sepData?.nama_diagnosa && (
                    <p className="text-xs text-muted-foreground">Current: {sepData.nama_diagnosa}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kls_rawat_naik">Naik Kelas</Label>
                  <Select
                    value={sepEditForm.kls_rawat_naik}
                    onValueChange={(v) => setSepEditForm(prev => ({ ...prev, kls_rawat_naik: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak naik kelas</SelectItem>
                      <SelectItem value="1">Kelas 1</SelectItem>
                      <SelectItem value="2">Kelas 2</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="vvip">VVIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pembiayaan">Pembiayaan</Label>
                  <Select
                    value={sepEditForm.pembiayaan}
                    onValueChange={(v) => setSepEditForm(prev => ({ ...prev, pembiayaan: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih pembiayaan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      <SelectItem value="1">Pribadi</SelectItem>
                      <SelectItem value="2">Pemberi Kerja</SelectItem>
                      <SelectItem value="3">Asuransi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="penanggung_jawab">Penanggung Jawab</Label>
                  <Input
                    id="penanggung_jawab"
                    placeholder="Nama penanggung jawab"
                    value={sepEditForm.penanggung_jawab}
                    onChange={(e) => setSepEditForm(prev => ({ ...prev, penanggung_jawab: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="no_telp">No. Telepon</Label>
                <Input
                  id="no_telp"
                  placeholder="Nomor telepon pasien"
                  value={sepEditForm.no_telp}
                  onChange={(e) => setSepEditForm(prev => ({ ...prev, no_telp: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="catatan">Catatan</Label>
                <Textarea
                  id="catatan"
                  placeholder="Catatan tambahan untuk SEP"
                  value={sepEditForm.catatan}
                  onChange={(e) => setSepEditForm(prev => ({ ...prev, catatan: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSEPOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateSEP} disabled={updatingSEP}>
              {updatingSEP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update SEP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Pembayaran */}
      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ubah Metode Pembayaran</DialogTitle>
            <DialogDescription>
              Ubah penjamin / asuransi untuk pendaftaran ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(val) => setPaymentForm(prev => ({ ...prev, payment_method: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Umum / Cash</SelectItem>
                  <SelectItem value="bpjs">BPJS</SelectItem>
                  <SelectItem value="insurance">Asuransi Lain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentForm.payment_method === "bpjs" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bpjs_number">Nomor BPJS</Label>
                  <Input
                    id="bpjs_number"
                    placeholder="Masukkan nomor kartu BPJS"
                    value={paymentForm.bpjs_number}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, bpjs_number: e.target.value }))}
                  />
                </div>

                {/* SEP Lookup Section */}
                <div className="space-y-3 rounded-lg border p-3 bg-blue-50/50 border-blue-200">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Assign SEP (Opsional)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Masukkan nomor SEP"
                      value={sepInputNumber}
                      onChange={(e) => {
                        setSepInputNumber(e.target.value);
                        if (foundSEP) {
                          setFoundSEP(null);
                          setSepSearchError("");
                          setSelectedVisitId("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchSEP();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleSearchSEP}
                      disabled={searchingSEP || !sepInputNumber.trim()}
                    >
                      {searchingSEP ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {sepSearchError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {sepSearchError}
                    </p>
                  )}

                  {/* SEP Preview */}
                  {foundSEP && (
                    <div className="space-y-3">
                      <div className="rounded-md border bg-white p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">SEP Ditemukan</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">No. SEP:</span>
                            <p className="font-mono font-medium">{foundSEP.noSep}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tanggal:</span>
                            <p className="font-medium">{foundSEP.tglSep}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Peserta:</span>
                            <p className="font-medium">{foundSEP.peserta?.nama || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">No. Kartu:</span>
                            <p className="font-mono font-medium">{foundSEP.peserta?.noKartu || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Poli:</span>
                            <p className="font-medium">{foundSEP.poli || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Diagnosa:</span>
                            <p className="font-medium">{foundSEP.diagnosa || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Jenis Pelayanan:</span>
                            <p className="font-medium">
                              {foundSEP.jnsPelayanan === "1" ? "Rawat Inap" : foundSEP.jnsPelayanan === "2" ? "Rawat Jalan" : foundSEP.jnsPelayanan}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Kelas Rawat:</span>
                            <p className="font-medium">Kelas {foundSEP.peserta?.klsRawat?.klsRawatHak || "-"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Visit Selector */}
                      {registration?.visits && registration.visits.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">Assign ke Visit (Opsional)</Label>
                          <Select
                            value={selectedVisitId}
                            onValueChange={setSelectedVisitId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih visit untuk assign SEP" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Tidak assign ke visit</SelectItem>
                              {registration.visits.map((v) => (
                                <SelectItem key={v.id || v.ID} value={String(v.id || v.ID)}>
                                  {v.visit_number} - {v.visit_type === "emergency" ? "UGD" : v.visit_type === "inpatient" ? "Rawat Inap" : v.visit_type === "outpatient" ? "Rawat Jalan" : v.visit_type}
                                  {v.room?.name ? ` (${v.room.name})` : ""}
                                  {" "}- {v.status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={handleSaveSEP}
                        disabled={savingSEP}
                      >
                        {savingSEP ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Simpan SEP & Assign ke Pendaftaran
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {paymentForm.payment_method === "insurance" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="insurance_name">Nama Asuransi</Label>
                  <Input
                    id="insurance_name"
                    placeholder="Masukkan nama asuransi"
                    value={paymentForm.insurance_name}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, insurance_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurance_number">Nomor Polis</Label>
                  <Input
                    id="insurance_number"
                    placeholder="Masukkan nomor polis asuransi"
                    value={paymentForm.insurance_number}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, insurance_number: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdatePayment} disabled={updatingPayment}>
              {updatingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Delete SEP */}
      <AlertDialog open={deleteSEPOpen} onOpenChange={setDeleteSEPOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus SEP?
            </AlertDialogTitle>
            <AlertDialogDescription>
              SEP dengan nomor <strong className="font-mono">{sepData?.no_sep}</strong> akan dihapus dari BPJS VClaim.
              <br /><br />
              <span className="text-destructive font-medium">âš ï¸ Tindakan ini tidak dapat dibatalkan.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSEP}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSEP}
              disabled={deletingSEP}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSEP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus SEP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hapus SPRI dari BPJS */}
      <AlertDialog open={deleteSPRIOpen} onOpenChange={setDeleteSPRIOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus SPRI dari BPJS?
            </AlertDialogTitle>
            <AlertDialogDescription>
              SPRI <strong className="font-mono">{spriData?.no_spri}</strong> akan dihapus dari sistem BPJS VClaim.
              <br /><br />
              <span className="text-destructive font-medium">⚠️ Tindakan ini tidak dapat dibatalkan.</span>
              <br />
              <span className="text-muted-foreground text-sm">Jika BPJS mengembalikan kode 200, data lokal akan ikut dihapus sekaligus.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSPRI}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSPRI}
              disabled={deletingSPRI}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSPRI && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus dari BPJS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  User,
  AlertTriangle,
  Bed,
  Building,
  UserRound,
  Check,
  ExternalLink,
  Calendar,
  FileText,
  ChevronLeft,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import {
  admissionRequestApi,
  type AdmissionRequest,
} from "@/lib/api/admission-request";
import {
  roomsApi,
  type Room,
  type RoomUnit,
  type Bed as RoomBed,
} from "@/lib/api/rooms";
import { employeesApi } from "@/lib/api/employees";
import { patientsApi, type Patient, api } from "@/lib/api";
import { vclaimApi, type SEPLocal, type VClaimSEP } from "@/lib/api/vclaim";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { SPRIFormSheet } from "@/components/sep/spri-form-sheet";
import { EditPaymentDialog } from "@/pages/registrations/edit-payment-dialog";
import { formatPatientName } from "@/lib/print-utils";
import { SignOnBehalfDialog } from "@/components/signature/sign-on-behalf-dialog";

interface RoomWithBeds extends Room {
  available_beds?: number;
  total_beds?: number;
}

interface RoomUnitWithBeds extends RoomUnit {
  beds?: RoomBed[];
}

interface Doctor {
  id: number;
  nama_lengkap: string;
  nip?: string;
  spesialisasi?: string;
}

export default function AdmissionRequestShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [request, setRequest] = useState<AdmissionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Room/Bed/Doctor Selection
  const [inpatientRooms, setInpatientRooms] = useState<RoomWithBeds[]>([]);
  const [roomUnits, setRoomUnits] = useState<RoomUnitWithBeds[]>([]);
  const [availableBeds, setAvailableBeds] = useState<RoomBed[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | undefined>();
  const [autoSelectData, setAutoSelectData] = useState<{unitId?: number, bedId?: number} | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>();
  const [processNotes, setProcessNotes] = useState("");

  // Reject Dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // BPJS Warning Dialog (pasien BPJS tanpa SEP)
  const [bpjsWarningOpen, setBpjsWarningOpen] = useState(false);

  // SEP Form
  const [sepSheetOpen, setSepSheetOpen] = useState(false);
  const [sepNumber, setSepNumber] = useState("");
  const [patientDetail, setPatientDetail] = useState<Patient | null>(null);
  const [_loadingPatient, setLoadingPatient] = useState(false);
  const [inpatientVisitId, setInpatientVisitId] = useState<number | null>(null);

  // Edit Payment
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);

  // Assign SEP
  const [assignSepOpen, setAssignSepOpen] = useState(false);
  const [sepInputNumber, setSepInputNumber] = useState("");
  const [searchingSEP, setSearchingSEP] = useState(false);
  const [savingSEP, setSavingSEP] = useState(false);
  const [foundSEP, setFoundSEP] = useState<VClaimSEP | null>(null);
  const [sepSearchError, setSepSearchError] = useState("");

  // SPRI (Surat Perintah Rawat Inap)
  const [spriSheetOpen, setSpriSheetOpen] = useState(false);
  const [spriNumber, setSpriNumber] = useState("");
  const [existingOutpatientSEP, setExistingOutpatientSEP] = useState<SEPLocal | null>(null);

  // Success / Signature Modal
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  useEffect(() => {
    if (request?.status === "pending") {
      fetchInpatientRooms();
      fetchDoctors();
      
      if (request.suggested_bed && request.suggested_bed.room_unit?.room?.id) {
         setAutoSelectData({
            unitId: request.suggested_bed.room_unit.id,
            bedId: request.suggested_bed.id
         });
         setSelectedRoomId(request.suggested_bed.room_unit.room.id);
      }

      // Fetch patient detail for SEP form
      const patientId = getPatient(request)?.id;
      if (patientId) {
        fetchPatientDetail(patientId);
        // Fetch existing SEP for rawat inap (jns_pelayanan=1) for this patient
        fetchExistingSEP(patientId, request.source_visit_id);
        // Fetch existing SPRI
        fetchExistingSPRI(request.registration_id, request.source_visit_id);
        // Fetch outpatient SEP (needed for SPRI form)
        fetchOutpatientSEP(request.source_visit_id, request.registration_id);
      }
    }
  }, [request?.status]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchBedsForRoom(selectedRoomId, autoSelectData);
      setAutoSelectData(null);
    } else {
      setRoomUnits([]);
      setAvailableBeds([]);
      setSelectedUnitId(null);
      setSelectedBedId(undefined);
    }
  }, [selectedRoomId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const response = await admissionRequestApi.getById(Number(id));
      const data = response.data?.data;
      setRequest(data);
      setPageTitle(`Permintaan ${data?.request_number || ""}`);
    } catch (error) {
      console.error("Failed to fetch admission request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data permintaan rawat inap",
      });
      navigate("/registrations?tab=admission_requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetail = async (patientId: number) => {
    try {
      setLoadingPatient(true);
      const response = await patientsApi.getById(patientId);
      setPatientDetail(response.data);
    } catch (error) {
      console.error("Failed to fetch patient detail:", error);
    } finally {
      setLoadingPatient(false);
    }
  };

  const fetchExistingSEP = async (_patientId: number, sourceVisitId?: number) => {
    try {
      // Cari SEP rawat inap yang SUDAH terhubung ke source visit ini
      // Tidak boleh ambil SEP dari visit/registrasi lain
      if (sourceVisitId) {
        try {
          const visitSEPRes = await vclaimApi.getSEPByVisit(sourceVisitId);
          if (visitSEPRes.data?.data?.no_sep) {
            // Check if it's rawat inap SEP (jns_pelayanan = 1)
            if (visitSEPRes.data.data.jns_pelayanan === "1") {
              setSepNumber(visitSEPRes.data.data.no_sep);
              return;
            }
          }
        } catch {
          // No SEP found for this visit — SEP belum dibuat, biarkan kosong
        }
      }

      // Cari SEP rawat inap by registration_id dari admission request
      if (request?.registration_id) {
        try {
          const regSEPRes = await vclaimApi.getSEPByRegistration(request.registration_id);
          if (regSEPRes.data?.data?.no_sep) {
            if (regSEPRes.data.data.jns_pelayanan === "1") {
              setSepNumber(regSEPRes.data.data.no_sep);
              return;
            }
          }
        } catch {
          // No SEP found for this registration — biarkan kosong
        }
      }

      // SEP belum ada — user harus buat SEP baru via form
      // TIDAK fallback ke SEP pasien lain agar tidak salah ambil
    } catch (error) {
      console.error("Failed to fetch existing SEP:", error);
    }
  };

  const fetchExistingSPRI = async (registrationId?: number, sourceVisitId?: number) => {
    try {
      // Try by source visit first
      if (sourceVisitId) {
        try {
          const res = await vclaimApi.getSPRIByVisit(sourceVisitId);
          if (res.data?.data?.no_spri) {
            setSpriNumber(res.data.data.no_spri);
            return;
          }
        } catch { /* not found */ }
      }
      // Then by registration
      if (registrationId) {
        try {
          const res = await vclaimApi.getSPRIByRegistration(registrationId);
          if (res.data?.data?.no_spri) {
            setSpriNumber(res.data.data.no_spri);
            return;
          }
        } catch { /* not found */ }
      }
    } catch (error) {
      console.error("Failed to fetch existing SPRI:", error);
    }
  };

  const fetchOutpatientSEP = async (sourceVisitId?: number, registrationId?: number) => {
    try {
      // Get the outpatient SEP (jns_pelayanan=2) from source visit — needed for SPRI creation
      if (sourceVisitId) {
        try {
          const res = await vclaimApi.getSEPByVisit(sourceVisitId);
          if (res.data?.data?.no_sep && res.data.data.jns_pelayanan === "2") {
            setExistingOutpatientSEP(res.data.data);
            return;
          }
          // Could also be a UGD SEP (jns_pelayanan=2 for gawat_darurat)
          if (res.data?.data?.no_sep) {
            setExistingOutpatientSEP(res.data.data);
            return;
          }
        } catch { /* not found */ }
      }
      if (registrationId) {
        try {
          const res = await vclaimApi.getSEPByRegistration(registrationId);
          if (res.data?.data?.no_sep) {
            setExistingOutpatientSEP(res.data.data);
            return;
          }
        } catch { /* not found */ }
      }
    } catch (error) {
      console.error("Failed to fetch outpatient SEP:", error);
    }
  };

  const getPatient = (req: AdmissionRequest) => {
    return (
      req.patient ||
      req.registration?.patient ||
      req.source_visit?.registration?.patient
    );
  };

  const fetchInpatientRooms = async () => {
    try {
      setLoadingRooms(true);
      const response = await roomsApi.getAll({
        room_type: "rawat_inap",
        is_active: "true",
      });
      const rooms = response.data?.data || [];

      const roomsWithBeds = await Promise.all(
        rooms.map(async (room: Room) => {
          try {
            const unitsRes = await roomsApi.getUnits(room.id);
            const units = unitsRes.data?.data || [];
            let totalBeds = 0;
            let availableBeds = 0;

            for (const unit of units) {
              if (unit.beds) {
                totalBeds += unit.beds.length;
                availableBeds += unit.beds.filter(
                  (b: RoomBed) => b.status === "available"
                ).length;
              }
            }

            return {
              ...room,
              total_beds: totalBeds,
              available_beds: availableBeds,
            };
          } catch {
            return { ...room, total_beds: 0, available_beds: 0 };
          }
        })
      );

      setInpatientRooms(roomsWithBeds);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchBedsForRoom = async (roomId: number, preselect?: {unitId?: number, bedId?: number} | null) => {
    try {
      setLoadingBeds(true);
      const response = await roomsApi.getUnits(roomId);
      const units: RoomUnitWithBeds[] = response.data?.data || [];
      setRoomUnits(units);

      const allBeds: RoomBed[] = [];
      units.forEach((unit) => {
        if (unit.beds) {
          allBeds.push(...unit.beds);
        }
      });
      setAvailableBeds(allBeds);

      if (preselect?.unitId) {
        setSelectedUnitId(preselect.unitId);
      } else {
        const firstAvailableUnit = units.find((u) =>
          u.beds?.some((b: RoomBed) => b.status === "available")
        );
        if (firstAvailableUnit) {
          setSelectedUnitId(firstAvailableUnit.id);
        }
      }
      
      if (preselect?.bedId) {
        setSelectedBedId(preselect.bedId);
      }
    } catch (error) {
      console.error("Failed to fetch beds:", error);
    } finally {
      setLoadingBeds(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const response = await employeesApi.getAll({
        tipe_karyawan: "dokter",
        is_active: "true",
      });
      const employees = response.data?.data || [];
      setDoctors(
        employees.map((e) => ({
          id: e.id,
          nama_lengkap: e.nama_lengkap,
          nip: e.nip,
          spesialisasi: e.spesialisasi,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleProcessClick = () => {
    if (!request || !selectedRoomId || !selectedBedId || !selectedDoctorId) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Pilih ruangan, bed, dan dokter terlebih dahulu",
      });
      return;
    }

    // Jika BPJS dan belum ada SPRI atau SEP → tampilkan warning dialog
    if (isBPJS && (!spriNumber || !sepNumber)) {
      setBpjsWarningOpen(true);
      return;
    }

    // Langsung proses
    handleProcess();
  };

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

  const handleAssignSEP = async () => {
    if (!foundSEP || !request) return;
    setSavingSEP(true);
    try {
      const patientId = patientDetail?.id || getPatient(request)?.id || 0;
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
        registration_id: request.registration_id,
        visit_id: request.source_visit_id,
      });

      setSepNumber(foundSEP.noSep);
      toast({
        title: "Berhasil",
        description: `SEP ${foundSEP.noSep} berhasil ditambahkan`,
      });
      setAssignSepOpen(false);
      setFoundSEP(null);
      setSepInputNumber("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal menambahkan SEP",
      });
    } finally {
      setSavingSEP(false);
    }
  };

  const handleRemoveSEP = async () => {
    if (!sepNumber) return;
    try {
      await api.delete(`/bpjs/vclaim/sep/${encodeURIComponent(sepNumber)}/local`);
      setSepNumber("");
      toast({
        title: "Berhasil",
        description: "SEP berhasil dihapus dari kunjungan ini",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal menghapus SEP",
      });
    }
  };

  const handleProcess = async () => {
    if (!request || !selectedRoomId || !selectedBedId || !selectedDoctorId) {
      return;
    }

    try {
      setProcessing(true);
      const response = await admissionRequestApi.process(request.id, {
        room_id: selectedRoomId,
        bed_id: selectedBedId,
        doctor_id: selectedDoctorId,
        admin_notes: processNotes,
        payment_method: isBPJS ? "bpjs" : "cash",
      });

      // Get updated request with inpatient_visit_id from response
      const updatedRequest = response.data?.data;
      let newVisitId: number | null = null;

      if (updatedRequest) {
        setRequest(updatedRequest);
        if (updatedRequest.inpatient_visit_id) {
          newVisitId = updatedRequest.inpatient_visit_id;
          setInpatientVisitId(newVisitId);
        }
      }

      // Auto-update SEP dengan visit_id baru
      if (sepNumber && newVisitId) {
        try {
          await api.patch(`/bpjs/vclaim/sep/${sepNumber}/visit`, {
            visit_id: newVisitId,
          });
        } catch (sepError) {
          console.error("Failed to update SEP visit_id:", sepError);
          // Don't fail the whole process, just log warning
        }
      }

      toast({
        title: "Berhasil",
        description:
          "Permintaan rawat inap berhasil diproses. Kunjungan rawat inap telah dibuat.",
      });

      const regId = updatedRequest?.registration_id || request?.registration_id;
      if (regId) {
        navigate(`/registrations/${regId}`);
      } else {
        navigate("/registrations?tab=admission_requests");
      }
    } catch (error) {
      console.error("Failed to process request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memproses permintaan rawat inap",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectReason.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Masukkan alasan penolakan",
      });
      return;
    }

    try {
      setRejecting(true);
      await admissionRequestApi.reject(request.id, {
        rejection_reason: rejectReason,
      });

      toast({
        title: "Ditolak",
        description: "Permintaan rawat inap telah ditolak",
      });

      setRejectDialogOpen(false);
      navigate("/registrations?tab=admission_requests");
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menolak permintaan",
      });
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-300"
          >
            <Clock className="h-3 w-3 mr-1" /> Menunggu
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-300"
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Disetujui
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-300"
          >
            <XCircle className="h-3 w-3 mr-1" /> Ditolak
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="bg-gray-50 text-gray-700 border-gray-300"
          >
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
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600">Urgent</Badge>
        );
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const selectedUnit = roomUnits.find((u) => u.id === selectedUnitId);
  const bedsInUnit = selectedUnit?.beds || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">Permintaan tidak ditemukan</p>
        <Button variant="outline" asChild>
          <Link to="/registrations?tab=admission_requests">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Kembali
          </Link>
        </Button>
      </div>
    );
  }

  const patient = getPatient(request);
  const isPending = request.status === "pending";
  // Check payment method from registration first, fallback to patient jenis_jaminan
  const registrationPaymentMethod = request.registration?.payment_method;
  const isBPJS = registrationPaymentMethod
    ? registrationPaymentMethod === "bpjs"
    : patientDetail && (patientDetail.jenis_jaminan === "BPJS" || patientDetail.jenis_jaminan === "JKN");

  return (
    <div className="flex flex-1 flex-col px-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/registrations?tab=admission_requests">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{request.request_number}</h1>
            <p className="text-sm text-muted-foreground">
              Permintaan Rawat Inap
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(request.status)}
          {getPriorityBadge(request.priority)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 flex-1 min-h-0">
        {/* Left Column - Detail Permintaan */}
        <div className="rounded-lg border flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 shrink-0">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detail Permintaan
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Patient Info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <Link
                  to={`/patient-search/${patient?.id}`}
                  className="font-semibold text-lg hover:underline hover:text-primary"
                >
                  {formatPatientName(patient?.name || patient?.nama_lengkap, patientDetail?.jenis_kelamin, undefined, patientDetail?.tanggal_lahir) || "N/A"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  RM: {patient?.medical_record_number || patient?.no_rm || "N/A"}
                </p>
                {patient?.birth_date && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(patient.birth_date), "dd MMMM yyyy", {
                      locale: idLocale,
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div className="space-y-3 text-sm border-t pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipe Admisi</span>
                <span className="font-medium capitalize">
                  {request.admission_type}
                </span>
              </div>
              {request.preferred_class && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kelas Pilihan</span>
                  <span className="font-medium capitalize">
                    {request.preferred_class.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asal Unit</span>
                <Link
                  to={`/visits/${request.source_visit?.id}`}
                  className="font-medium hover:underline hover:text-primary flex items-center gap-1"
                >
                  {request.source_visit?.room?.name || "N/A"}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal Request</span>
                <span className="font-medium">
                  {format(new Date(request.requested_at), "dd MMM yyyy HH:mm", {
                    locale: idLocale,
                  })}
                </span>
              </div>
              {request.requested_by && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diminta oleh</span>
                  <span className="font-medium">
                    {request.requested_by.name || request.requested_by.username}
                  </span>
                </div>
              )}
              {request.suggested_bed && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saran Tempat Tidur</span>
                  <span className="font-medium text-right">
                    {request.suggested_bed.room_unit?.room?.name} - {request.suggested_bed.room_unit?.name} (Bed {request.suggested_bed.bed_number})
                  </span>
                </div>
              )}

              {/* Payment Method Row */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pembayaran</span>
                <div className="flex items-center gap-1.5">
                  {isBPJS ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300">BPJS</Badge>
                  ) : request.registration?.payment_method === "insurance" ? (
                    <Badge variant="outline">Asuransi</Badge>
                  ) : (
                    <Badge variant="outline">Umum / Cash</Badge>
                  )}
                  {isPending && request.registration_id && (
                    <button
                      type="button"
                      onClick={() => setEditPaymentOpen(true)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Ubah metode pembayaran"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {isBPJS && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SPRI</span>
                  {spriNumber ? (
                    <span className="font-medium font-mono text-green-600">{spriNumber}</span>
                  ) : existingOutpatientSEP ? (
                    <button
                      type="button"
                      onClick={() => setSpriSheetOpen(true)}
                      className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                      Buat SPRI
                    </button>
                  ) : (
                    <span className="text-amber-600 text-xs">Perlu SEP Rajal/UGD dahulu</span>
                  )}
                </div>
              )}
              {isBPJS && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SEP Ranap</span>
                  {sepNumber ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium font-mono text-green-600">{sepNumber}</span>
                      {isPending && (
                        <button
                          type="button"
                          onClick={handleRemoveSEP}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Hapus SEP"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {spriNumber && (
                        <button
                          type="button"
                          onClick={() => setSepSheetOpen(true)}
                          className="text-blue-600 underline hover:text-blue-800 font-medium text-xs"
                        >
                          Buat SEP
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAssignSepOpen(true)}
                        className="text-blue-600 underline hover:text-blue-800 font-medium text-xs"
                      >
                        Tambahkan SEP
                      </button>
                      {!spriNumber && (
                        <span className="text-muted-foreground text-xs">/ Buat SPRI dahulu</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reason & Notes */}
            {(request.admission_reason ||
              request.diagnosis ||
              request.special_notes) && (
                <div className="space-y-3 text-sm border-t pt-4">
                  {request.admission_reason && (
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Alasan Rawat Inap:
                      </p>
                      <p className="bg-muted/50 p-2 rounded">
                        {request.admission_reason}
                      </p>
                    </div>
                  )}
                  {request.diagnosis && (
                    <div>
                      <p className="text-muted-foreground mb-1">Diagnosis:</p>
                      <p className="bg-muted/50 p-2 rounded">{request.diagnosis}</p>
                    </div>
                  )}
                  {request.special_notes && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-yellow-700 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" /> Catatan Khusus:
                      </p>
                      <p className="text-yellow-800">{request.special_notes}</p>
                    </div>
                  )}
                </div>
              )}

            {/* Rejection Info */}
            {request.status === "rejected" && request.rejection_reason && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Alasan Penolakan:</p>
                  <p>{request.rejection_reason}</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Processed Info */}
            {request.status === "approved" && (
              <div className="space-y-3 text-sm border-t pt-4">
                <p className="font-medium text-green-700">Hasil Proses:</p>
                <div className="grid grid-cols-2 gap-3">
                  {request.approved_room && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Ruangan</p>
                      <p className="font-medium">{request.approved_room.name}</p>
                    </div>
                  )}
                  {request.approved_bed && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Bed</p>
                      <p className="font-medium">
                        {request.approved_bed.bed_number}
                      </p>
                    </div>
                  )}
                  {request.doctor && (
                    <div className="p-2 bg-muted/50 rounded col-span-2">
                      <p className="text-xs text-muted-foreground">DPJP</p>
                      <p className="font-medium">{request.doctor.nama_lengkap}</p>
                    </div>
                  )}
                </div>
                {request.inpatient_visit_id && (
                  <Button asChild className="w-full mt-2">
                    <Link to={`/visits/${request.inpatient_visit_id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Lihat Kunjungan Rawat Inap
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Proses Pemilihan */}
        <div className="rounded-lg border lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 shrink-0 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2">
              {isPending ? (
                <>
                  <Building className="h-4 w-4" />
                  Proses Admisi
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Status Permintaan
                </>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isPending ? (
              <div className="space-y-6">
                {/* Room Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Pilih Ruangan <span className="text-destructive">*</span>
                  </Label>
                  {loadingRooms ? (
                    <div className="flex items-center justify-center py-8 border rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Memuat ruangan...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {inpatientRooms.map((room) => {
                        const isSelected = selectedRoomId === room.id;
                        const availableBedCount = room.available_beds || 0;
                        const totalBedCount = room.total_beds || 0;

                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              setSelectedBedId(undefined);
                              setSelectedUnitId(null);
                            }}
                            disabled={availableBedCount === 0}
                            className={cn(
                              "p-3 rounded-lg border-2 text-left transition-all relative",
                              isSelected
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                : availableBedCount === 0
                                  ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                  : "border-muted hover:border-primary/50 hover:bg-muted/30"
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <Check className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div className="font-semibold text-sm mb-1">
                              {room.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {room.code}
                            </div>
                            <div
                              className={cn(
                                "text-xs font-medium mt-2 flex items-center gap-1",
                                availableBedCount > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              <Bed className="h-3 w-3" />
                              {availableBedCount} / {totalBedCount} tersedia
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bed Selection */}
                {selectedRoomId && (
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Bed className="h-4 w-4" />
                        Pilih Tempat Tidur{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-green-500"></div>
                          <span>Tersedia</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-red-400"></div>
                          <span>Terisi</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-primary ring-2 ring-primary ring-offset-1"></div>
                          <span>Dipilih</span>
                        </div>
                      </div>
                    </div>

                    {loadingBeds ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">
                          Memuat data bed...
                        </span>
                      </div>
                    ) : roomUnits.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {roomUnits.map((unit) => {
                            const availableCount =
                              unit.beds?.filter(
                                (b: RoomBed) => b.status === "available"
                              ).length || 0;
                            const totalCount = unit.beds?.length || 0;
                            const isSelected = selectedUnitId === unit.id;

                            return (
                              <button
                                key={unit.id}
                                type="button"
                                onClick={() => setSelectedUnitId(unit.id)}
                                disabled={availableCount === 0}
                                className={cn(
                                  "p-2 rounded-lg border-2 text-left transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/10"
                                    : availableCount === 0
                                      ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                      : "border-muted hover:border-primary/50"
                                )}
                              >
                                <div className="font-medium text-xs">
                                  {unit.name}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    availableCount > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  )}
                                >
                                  {availableCount}/{totalCount}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {selectedUnit && (
                          <div className="bg-background rounded-lg p-3 border">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex flex-wrap gap-2">
                                {bedsInUnit.map((bed: RoomBed) => {
                                  const isAvailable = bed.status === "available";
                                  const isSelected = selectedBedId === bed.id;

                                  return (
                                    <Tooltip key={bed.id}>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isAvailable) {
                                              setSelectedBedId(
                                                isSelected ? undefined : bed.id
                                              );
                                            }
                                          }}
                                          className={cn(
                                            "w-10 h-10 rounded-md flex flex-col items-center justify-center text-xs font-medium transition-all",
                                            isSelected
                                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                                              : isAvailable
                                                ? "bg-green-500 text-white hover:bg-green-600"
                                                : "bg-red-400 text-white cursor-not-allowed"
                                          )}
                                        >
                                          <Bed className="h-3 w-3" />
                                          <span className="text-[10px]">
                                            {bed.bed_number}
                                          </span>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="font-semibold">
                                          Bed {bed.bed_number}
                                        </p>
                                        {isAvailable ? (
                                          <p className="text-green-600">
                                            ✓ Tersedia
                                          </p>
                                        ) : (
                                          <p className="text-red-600">
                                            ✗ Terisi
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription>
                          Tidak ada unit/kamar di ruangan ini
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Doctor Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <UserRound className="h-4 w-4" />
                    DPJP <span className="text-destructive">*</span>
                  </Label>
                  {loadingDoctors ? (
                    <div className="flex items-center justify-center py-8 border rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Memuat daftar dokter...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {doctors.map((doctor) => {
                        const isSelected = selectedDoctorId === doctor.id;

                        return (
                          <button
                            key={doctor.id}
                            type="button"
                            onClick={() => setSelectedDoctorId(doctor.id)}
                            className={cn(
                              "p-3 rounded-lg border-2 text-left transition-all relative",
                              isSelected
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                : "border-muted hover:border-primary/50 hover:bg-muted/30"
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <Check className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <UserRound className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {doctor.nama_lengkap}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {doctor.spesialisasi || doctor.nip || "Dokter"}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Process Notes */}
                <div className="space-y-2">
                  <Label htmlFor="process_notes" className="text-sm">
                    Catatan Tambahan
                  </Label>
                  <Textarea
                    id="process_notes"
                    placeholder="Catatan tambahan untuk proses admisi..."
                    value={processNotes}
                    onChange={(e) => setProcessNotes(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                </div>



              </div>
            ) : (
              <div className="text-center py-8 flex-1">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4",
                    request.status === "approved"
                      ? "bg-green-100"
                      : request.status === "rejected"
                        ? "bg-red-100"
                        : "bg-gray-100"
                  )}
                >
                  {request.status === "approved" ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : request.status === "rejected" ? (
                    <XCircle className="h-8 w-8 text-red-600" />
                  ) : (
                    <Clock className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {request.status === "approved"
                    ? "Permintaan Disetujui"
                    : request.status === "rejected"
                      ? "Permintaan Ditolak"
                      : "Permintaan Dibatalkan"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {request.status === "approved"
                    ? "Kunjungan rawat inap telah dibuat"
                    : request.status === "rejected"
                      ? "Permintaan telah ditolak oleh admin"
                      : "Permintaan telah dibatalkan"}
                </p>
              </div>
            )}
          </div>
          {/* Sticky Action Footer */}
          {isPending && (
            <div className="shrink-0 border-t bg-background px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {selectedRoomId && selectedBedId && selectedDoctorId ? (
                  <span className="text-green-700 font-medium">
                    {inpatientRooms.find((r) => r.id === selectedRoomId)?.name} · Bed {availableBeds.find((b) => b.id === selectedBedId)?.bed_number} · {doctors.find((d) => d.id === selectedDoctorId)?.nama_lengkap}
                  </span>
                ) : (
                  <span>Pilih ruangan, bed, dan DPJP untuk melanjutkan</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Tolak
                </Button>
                <Button
                  onClick={handleProcessClick}
                  disabled={processing || !selectedRoomId || !selectedBedId || !selectedDoctorId}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Proses Admisi
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Permintaan Rawat Inap</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan permintaan rawat inap ini
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="font-medium">
                {formatPatientName(patient?.name || patient?.nama_lengkap, patientDetail?.jenis_kelamin, undefined, patientDetail?.tanggal_lahir)}
              </p>
              <p className="text-sm text-muted-foreground">
                RM: {patient?.medical_record_number || patient?.no_rm}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reject_reason">
                Alasan Penolakan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reject_reason"
                placeholder="Masukkan alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            >
              {rejecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menolak...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Tolak Permintaan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BPJS Warning Dialog - Pasien BPJS tanpa SPRI/SEP lengkap */}
      <Dialog open={bpjsWarningOpen} onOpenChange={setBpjsWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              SPRI/SEP Belum Lengkap
            </DialogTitle>
            <DialogDescription>
              Pasien ini terdaftar sebagai pasien <strong>BPJS</strong>, namun {!spriNumber ? "SPRI dan SEP" : "SEP"} Rawat Inap belum dibuat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Pasien akan tetap didaftarkan sebagai <strong>BPJS</strong>. SPRI dan SEP bisa dibuat nanti melalui halaman pendaftaran saat kartu BPJS sudah aktif.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setBpjsWarningOpen(false)}
              className="flex-1"
            >
              Batal, Lengkapi Dulu
            </Button>
            <Button
              onClick={() => {
                setBpjsWarningOpen(false);
                handleProcess();
              }}
              variant="secondary"
              className="flex-1"
            >
              Lanjut Tanpa SPRI/SEP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEP Form Sheet */}
      {patientDetail && (
        <SEPFormSheet
          open={sepSheetOpen}
          onOpenChange={setSepSheetOpen}
          patient={{
            id: patientDetail.id,
            no_rm: patientDetail.no_rm,
            nama_lengkap: patientDetail.nama_lengkap,
            nik: patientDetail.nik,
            no_bpjs: patientDetail.no_bpjs,
            tanggal_lahir: patientDetail.tanggal_lahir,
            jenis_kelamin: patientDetail.jenis_kelamin,
            no_telepon: patientDetail.no_telepon,
            kelas_bpjs: patientDetail.kelas_bpjs,
          }}
          visitId={inpatientVisitId || request?.source_visit_id || undefined}
          registrationId={request?.registration_id}
          initialValues={{
            jenisPelayanan: "1", // Rawat Inap
          }}
          onSEPCreated={(noSEP) => {
            setSepNumber(noSEP);
            toast({
              title: "Berhasil",
              description: `SEP Rawat Inap berhasil dibuat: ${noSEP}`,
            });
          }}
        />
      )}

      {/* Edit Payment Dialog */}
      {request?.registration_id && (
        <EditPaymentDialog
          open={editPaymentOpen}
          onOpenChange={setEditPaymentOpen}
          registrationId={request.registration_id}
          currentPaymentMethod={request.registration?.payment_method || "cash"}
          currentBpjsNumber={request.registration?.bpjs_number}
          patientBpjsNumber={patientDetail?.no_bpjs}
          onSuccess={() => fetchRequest()}
        />
      )}

      {/* Assign SEP Dialog */}
      <Dialog open={assignSepOpen} onOpenChange={(open) => {
        setAssignSepOpen(open);
        if (!open) {
          setFoundSEP(null);
          setSepInputNumber("");
          setSepSearchError("");
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambahkan SEP</DialogTitle>
            <DialogDescription>
              Masukkan nomor SEP yang sudah ada untuk ditambahkan ke kunjungan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="Masukkan nomor SEP"
                value={sepInputNumber}
                onChange={(e) => {
                  setSepInputNumber(e.target.value);
                  if (foundSEP) {
                    setFoundSEP(null);
                    setSepSearchError("");
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
                variant="outline"
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
              <p className="text-sm text-destructive">{sepSearchError}</p>
            )}

            {foundSEP && (
              <div className="rounded-lg border p-3 space-y-2 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <CheckCircle className="h-4 w-4" />
                  SEP Ditemukan
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">No. SEP</span>
                    <p className="font-mono font-medium">{foundSEP.noSep}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tgl SEP</span>
                    <p className="font-medium">{foundSEP.tglSep}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peserta</span>
                    <p className="font-medium">{foundSEP.peserta?.nama}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">No. Kartu</span>
                    <p className="font-mono">{foundSEP.peserta?.noKartu}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Jns Pelayanan</span>
                    <p className="font-medium">{foundSEP.jnsPelayanan === "1" ? "Rawat Inap" : "Rawat Jalan"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Diagnosis</span>
                    <p className="font-medium">{foundSEP.diagnosa}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignSepOpen(false)}>Batal</Button>
            <Button onClick={handleAssignSEP} disabled={!foundSEP || savingSEP}>
              {savingSEP ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Tambahkan SEP</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPRI Form Sheet */}
      {patientDetail && existingOutpatientSEP && (
        <SPRIFormSheet
          open={spriSheetOpen}
          onOpenChange={setSpriSheetOpen}
          activeSEP={existingOutpatientSEP}
          patient={{
            id: patientDetail.id,
            no_rm: patientDetail.no_rm,
            nama_lengkap: patientDetail.nama_lengkap,
            nik: patientDetail.nik,
            no_bpjs: patientDetail.no_bpjs,
            tanggal_lahir: patientDetail.tanggal_lahir,
            jenis_kelamin: patientDetail.jenis_kelamin,
          }}
          visitId={request?.source_visit_id || 0}
          onSPRICreated={(spriData) => {
            setSpriNumber(spriData.noSPRI);
            toast({
              title: "Berhasil",
              description: `SPRI berhasil dibuat: ${spriData.noSPRI}`,
            });
          }}
        />
      )}

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={(open) => {
        if (!open) {
          navigate("/registrations?tab=admission_requests");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pendaftaran Rawat Inap Berhasil</DialogTitle>
            <DialogDescription>
              Kunjungan rawat inap telah dibuat. Apakah Anda ingin wali dan pasien menandatangani Persetujuan Rawat Inap sekarang?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSuccessDialogOpen(false)}>
              Nanti Saja (Skip)
            </Button>
            <Button onClick={() => {
              setSuccessDialogOpen(false);
              setSignatureDialogOpen(true);
            }}>
              Tandatangani Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <SignOnBehalfDialog
        open={signatureDialogOpen}
        onOpenChange={(open) => {
          setSignatureDialogOpen(open);
          if (!open) {
            navigate("/registrations?tab=admission_requests");
          }
        }}
        documentType="general_consent_inpatient"
        documentId={inpatientVisitId || 0}
        visitId={inpatientVisitId || 0}
        signerHint="Silakan lengkapi Tanda Tangan"
        documentTitle="Persetujuan Umum Rawat Inap"
        slotLabels={{
          left: "Wali",
          right: "Pasien"
        }}
        fixedRoles={{
          left: "wali",
          right: "pasien"
        }}
        requiredSignatures={2}
      />
    </div>
  );
}

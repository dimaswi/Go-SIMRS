import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>();
  const [processNotes, setProcessNotes] = useState("");

  // Reject Dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  useEffect(() => {
    if (request?.status === "pending") {
      fetchInpatientRooms();
      fetchDoctors();
    }
  }, [request?.status]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchBedsForRoom(selectedRoomId);
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
      navigate("/admisi");
    } finally {
      setLoading(false);
    }
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

  const fetchBedsForRoom = async (roomId: number) => {
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

      const firstAvailableUnit = units.find((u) =>
        u.beds?.some((b: RoomBed) => b.status === "available")
      );
      if (firstAvailableUnit) {
        setSelectedUnitId(firstAvailableUnit.id);
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

  const handleProcess = async () => {
    if (!request || !selectedRoomId || !selectedBedId || !selectedDoctorId) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Pilih ruangan, bed, dan dokter terlebih dahulu",
      });
      return;
    }

    try {
      setProcessing(true);
      await admissionRequestApi.process(request.id, {
        room_id: selectedRoomId,
        bed_id: selectedBedId,
        doctor_id: selectedDoctorId,
        admin_notes: processNotes,
      });

      toast({
        title: "Berhasil",
        description:
          "Permintaan rawat inap berhasil diproses. Kunjungan rawat inap telah dibuat.",
      });

      navigate("/admisi");
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
      navigate("/admisi");
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

  const getPatient = (req: AdmissionRequest) => {
    return (
      req.patient ||
      req.registration?.patient ||
      req.source_visit?.registration?.patient
    );
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Permintaan tidak ditemukan</p>
        <Button variant="outline" asChild>
          <Link to="/admisi">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Kembali
          </Link>
        </Button>
      </div>
    );
  }

  const patient = getPatient(request);
  const isPending = request.status === "pending";

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admisi">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Detail Permintaan */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detail Permintaan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
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
                  {patient?.name || patient?.nama_lengkap || "N/A"}
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
          </CardContent>
        </Card>

        {/* Right Column - Proses Pemilihan */}
        <Card className="shadow-md lg:col-span-2">
          <CardHeader className="border-b bg-muted/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
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
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
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

                {/* Summary */}
                {selectedRoomId && selectedBedId && selectedDoctorId && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Pasien akan ditempatkan di{" "}
                      <strong>
                        {inpatientRooms.find((r) => r.id === selectedRoomId)?.name}
                      </strong>{" "}
                      - Bed{" "}
                      <strong>
                        {
                          availableBeds.find((b) => b.id === selectedBedId)
                            ?.bed_number
                        }
                      </strong>{" "}
                      dengan DPJP{" "}
                      <strong>
                        {
                          doctors.find((d) => d.id === selectedDoctorId)
                            ?.nama_lengkap
                        }
                      </strong>
                      .
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Tolak
                  </Button>
                  <Button
                    onClick={handleProcess}
                    disabled={
                      processing ||
                      !selectedRoomId ||
                      !selectedBedId ||
                      !selectedDoctorId
                    }
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
            ) : (
              <div className="text-center py-8">
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
          </CardContent>
        </Card>
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
                {patient?.name || patient?.nama_lengkap}
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
    </div>
  );
}

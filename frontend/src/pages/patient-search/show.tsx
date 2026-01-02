import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { patientsApi, type Patient } from "@/lib/api";
import { visitsApi, type Visit } from "@/lib/api/visits";
import { billingApi, type Billing } from "@/lib/api/billing";
import { setPageTitle } from "@/lib/page-title";
import {
  User,
  Loader2,
  MapPin,
  Phone,
  Users,
  Shield,
  Heart,
  CalendarPlus,
  FileText,
  History,
  AlertTriangle,
  CreditCard,
  Eye,
  Pencil,
} from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { id } from "date-fns/locale";

export default function PatientSearchShow() {
  const { id: patientId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingBillings, setLoadingBillings] = useState(false);

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
      <Card className="shadow-md">
        {/* Patient Header */}
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
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
                <h2 className="text-xl font-semibold">
                  {patient.nama_lengkap} <Badge variant={getStatusVariant(patient.status)} className="text-sm">{patient.status}</Badge>
                </h2>
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
            <div>
              <Button
                variant="outline"
                onClick={() => navigate(`/patients/${patient.id}/edit`)}
                className="mr-2 text-white bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300 hover:text-blue-800"
              >
                <Pencil /> Edit
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b rounded-none">
              <TabsTrigger
                value="detail"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                <FileText className="mr-2 h-4 w-4" />
                Detail Pasien
              </TabsTrigger>
              <TabsTrigger
                value="kunjungan"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                <History className="mr-2 h-4 w-4" />
                Riwayat Kunjungan
              </TabsTrigger>
              <TabsTrigger
                value="pembayaran"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Riwayat Pembayaran
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

            {/* Riwayat Kunjungan Tab */}
            <TabsContent value="kunjungan" className="mt-6">
              {loadingVisits ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visits.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    Riwayat Kunjungan
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Belum ada data riwayat kunjungan untuk pasien ini
                  </p>
                  <Button variant="default" size="sm">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Daftarkan Kunjungan Baru
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">No. Kunjungan</TableHead>
                      <TableHead className="w-[160px]">Tanggal</TableHead>
                      <TableHead>Ruangan</TableHead>
                      <TableHead>Dokter</TableHead>
                      <TableHead className="w-[120px]">Tipe</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="font-mono font-medium">
                          {visit.visit_number}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(visit.created_at)}
                        </TableCell>
                        <TableCell>{visit.room?.name || "-"}</TableCell>
                        <TableCell>
                          {visit.doctor?.user?.name ||
                            visit.doctor?.name ||
                            "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getVisitTypeLabel(visit.visit_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getVisitStatusVariant(visit.status)}>
                            {getVisitStatusLabel(visit.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/visits/${visit.id}`)}
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

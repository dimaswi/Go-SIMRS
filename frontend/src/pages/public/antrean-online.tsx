import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Search, CheckCircle2, User, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAppName, getAppLogo } from "@/lib/page-title";
import { resolveBackendFileUrl } from "@/lib/api/client";

// Minimal layout for public pages
function PublicLayout({ children }: { children: React.ReactNode }) {
  const [appName, setAppName] = useState(getAppName());
  const [appLogo, setAppLogo] = useState(getAppLogo());
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    api.get("/public/settings").then((res) => {
      const data = res.data?.data;
      if (data) {
        if (data.app_name) setAppName(data.app_name);
        if (data.app_logo) setAppLogo(data.app_logo);
      }
    }).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {appLogo && !logoError ? (
              <img
                src={resolveBackendFileUrl(appLogo)}
                alt="Logo"
                className="h-8 w-auto rounded object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                +
              </div>
            )}
            <span className="font-bold text-lg tracking-tight">{appName}</span>
          </div>
          <div className="text-sm text-muted-foreground font-medium hidden sm:block">
            Portal Pasien Umum
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {children}
      </main>
      <footer className="border-t bg-white py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

type Step = "identitas" | "jadwal" | "selesai";

interface PatientData {
  is_new_patient: boolean;
  nik: string;
  nama_lengkap: string;
  no_hp: string;
  tanggal_lahir: string; // YYYY-MM-DD
}

interface BookingData {
  booking_date: string; // YYYY-MM-DD
  room_id: number;
  doctor_id: number;
}

export default function AntreanOnlinePage() {
  const [step, setStep] = useState<Step>("identitas");
  const [patientData, setPatientData] = useState<PatientData>({
    is_new_patient: false,
    nik: "",
    nama_lengkap: "",
    no_hp: "",
    tanggal_lahir: "",
  });
  const [bookingData, setBookingData] = useState<BookingData>({
    booking_date: format(new Date(), "yyyy-MM-dd"),
    room_id: 0,
    doctor_id: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [ticket, setTicket] = useState<any>(null);

  // Derive rooms from schedules (exclude UGD)
  const availableRooms = Array.from(new Set(schedules.map((s) => s.room?.id))).map(
    (id) => schedules.find((s) => s.room?.id === id)?.room
  ).filter((room) => room && room.room_type !== "ugd" && room.name !== "UGD");

  // Derive doctors for selected room
  const availableDoctors = schedules
    .filter((s) => s.room_id === bookingData.room_id)
    .map((s) => s.employee)
    .filter(Boolean);

  useEffect(() => {
    if (step === "jadwal") {
      fetchSchedules(bookingData.booking_date);
    }
  }, [step, bookingData.booking_date]);

  const fetchSchedules = async (date: string) => {
    try {
      const res = await api.get(`/public/schedules?date=${date}`);
      setSchedules(res.data.data || []);
      // Reset room and doctor selection when date changes
      setBookingData((prev) => ({ ...prev, room_id: 0, doctor_id: 0 }));
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat jadwal dokter");
    }
  };

  const handleCheckNIK = async () => {
    if (patientData.nik.length !== 16) {
      toast.error("NIK harus 16 digit");
      return;
    }

    if (patientData.is_new_patient) {
      // For new patient, just proceed to form
      if (!patientData.nama_lengkap || !patientData.no_hp || !patientData.tanggal_lahir) {
        toast.error("Lengkapi semua data pasien baru");
        return;
      }
      setStep("jadwal");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get(`/public/check-nik?nik=${patientData.nik}`);
      if (res.data.message === "found") {
        setPatientData((prev) => ({
          ...prev,
          is_new_patient: false,
          nama_lengkap: res.data.data.nama_lengkap, // masked name
        }));
        toast.success("Data pasien ditemukan");
        setStep("jadwal");
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setPatientData((prev) => ({
          ...prev,
          is_new_patient: true,
        }));
        toast.info("NIK belum terdaftar. Silakan lengkapi data Pasien Baru.");
      } else {
        toast.error("Terjadi kesalahan saat mengecek NIK");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!bookingData.room_id || !bookingData.doctor_id) {
      toast.error("Pilih Poli dan Dokter terlebih dahulu");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/public/register-queue", {
        ...patientData,
        ...bookingData,
      });
      setTicket(res.data.data);
      setStep("selesai");
      toast.success("Pendaftaran berhasil!");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Gagal melakukan pendaftaran");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Pendaftaran Antrean Online</h1>
          <p className="text-muted-foreground">Khusus Pasien Umum (Non-BPJS)</p>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors", step === "identitas" ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-primary/30")}>1</div>
            <div className={cn("h-1 w-12 rounded-full", step === "jadwal" || step === "selesai" ? "bg-primary" : "bg-primary/20")} />
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors", step === "jadwal" ? "border-primary bg-primary text-primary-foreground" : (step === "selesai" ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-primary/30"))}>2</div>
            <div className={cn("h-1 w-12 rounded-full", step === "selesai" ? "bg-primary" : "bg-primary/20")} />
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors", step === "selesai" ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-primary/30")}>3</div>
          </div>
        </div>

        {step === "identitas" && (
          <Card>
            <CardHeader>
              <CardTitle>Validasi Identitas Pasien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nik">Nomor Induk Kependudukan (NIK)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nik"
                    className="pl-9"
                    placeholder="Masukkan 16 digit NIK..."
                    maxLength={16}
                    value={patientData.nik}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPatientData({ ...patientData, nik: val, is_new_patient: false });
                    }}
                  />
                </div>
              </div>

              {patientData.is_new_patient && (
                <div className="grid gap-4 mt-4 p-4 border rounded-lg bg-muted/10">
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama Lengkap (Sesuai KTP)</Label>
                    <Input
                      id="nama"
                      placeholder="Masukkan nama lengkap..."
                      value={patientData.nama_lengkap}
                      onChange={(e) => setPatientData({ ...patientData, nama_lengkap: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hp">Nomor HP</Label>
                      <Input
                        id="hp"
                        placeholder="08..."
                        value={patientData.no_hp}
                        onChange={(e) => setPatientData({ ...patientData, no_hp: e.target.value.replace(/\D/g, "") })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">Tanggal Lahir</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={patientData.tanggal_lahir}
                        onChange={(e) => setPatientData({ ...patientData, tanggal_lahir: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleCheckNIK} disabled={isLoading || patientData.nik.length !== 16}>
                {isLoading ? "Memeriksa..." : (patientData.is_new_patient ? "Lanjut ke Jadwal" : "Cek NIK")}
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === "jadwal" && (
          <Card>
            <CardHeader>
              <CardTitle>Pilih Poli & Dokter</CardTitle>
              <CardDescription>
                Pendaftaran untuk: <strong className="text-foreground">{patientData.is_new_patient ? patientData.nama_lengkap : patientData.nama_lengkap}</strong>
                <br />
                NIK: {patientData.nik}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Tanggal Kunjungan</Label>
                <Input
                  type="date"
                  min={format(new Date(), "yyyy-MM-dd")}
                  value={bookingData.booking_date}
                  onChange={(e) => setBookingData({ ...bookingData, booking_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Poliklinik Tujuan</Label>
                <Select
                  value={bookingData.room_id ? bookingData.room_id.toString() : ""}
                  onValueChange={(val) => setBookingData({ ...bookingData, room_id: parseInt(val), doctor_id: 0 })}
                  disabled={availableRooms.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={availableRooms.length > 0 ? "Pilih Poliklinik" : "Tidak ada jadwal poli di tanggal ini"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dokter Poli</Label>
                <Select
                  value={bookingData.doctor_id ? bookingData.doctor_id.toString() : ""}
                  onValueChange={(val) => setBookingData({ ...bookingData, doctor_id: parseInt(val) })}
                  disabled={!bookingData.room_id || availableDoctors.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={bookingData.room_id ? "Pilih Dokter" : "Pilih Poli terlebih dahulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDoctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id.toString()}>
                        {doc.nama_lengkap}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("identitas")}>
                Kembali
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || !bookingData.doctor_id || !bookingData.room_id}>
                {isLoading ? "Memproses..." : "Konfirmasi & Daftar"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === "selesai" && ticket && (
          <Card className="border-primary/50 shadow-md overflow-hidden">
            <div className="bg-primary p-6 text-center text-primary-foreground">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold">Pendaftaran Berhasil!</h2>
              <p className="opacity-90 mt-1">Harap simpan bukti pendaftaran ini</p>
            </div>

            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border border-dashed">
                <span className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-1">NOMOR ANTRIAN</span>
                <span className="text-6xl font-black tracking-wider text-foreground">
                  {ticket.registration_number.split("-").length === 3
                    ? `${ticket.registration_number.split("-")[0]}-${parseInt(ticket.registration_number.split("-")[2], 10)}`
                    : ticket.registration_number}
                </span>
                <span className="text-xs text-muted-foreground mt-3 uppercase tracking-widest">Kode Booking: {ticket.registration_number}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-2"><User className="w-4 h-4" /> Pasien</div>
                  <div className="font-medium text-foreground">{ticket.patient?.nama_lengkap || patientData.nama_lengkap}</div>
                  <div className="text-xs text-muted-foreground">NIK: {patientData.nik}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Jadwal Kunjungan</div>
                  <div className="font-medium text-foreground">{format(new Date(ticket.scheduled_date), "EEEE, dd MMMM yyyy", { locale: id })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Poliklinik Tujuan</div>
                  <div className="font-medium text-foreground">{ticket.destination_room?.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-2"><User className="w-4 h-4" /> Dokter</div>
                  <div className="font-medium text-foreground">{ticket.doctor?.nama_lengkap}</div>
                </div>
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm leading-relaxed border border-blue-100">
                <strong>Penting:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Tunjukkan nomor antrian ini ke petugas loket pendaftaran saat hari kunjungan.</li>
                  <li>Harap datang 30 menit sebelum jadwal praktik dokter dimulai.</li>
                  <li>Jika Anda Pasien Baru, harap membawa KTP Asli untuk verifikasi data.</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="bg-muted/10 p-6 flex justify-center">
              <Button onClick={() => window.print()} variant="outline" className="w-full sm:w-auto">
                Cetak Bukti Pendaftaran
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Save,
  Loader2,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Home,
  Ambulance,
  Hospital,
  FileText,
  ClipboardList,
  ExternalLink,
  Send,
  QrCode,
  Plus,
  Search,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { SearchModal } from "@/components/sep/search-modal";
import { cn } from "@/lib/utils";
import { CheckInQRCode } from "@/components/qrcode/checkin-qrcode";
import { BPJSControlSection } from "@/components/medical-record/bpjs-control-section";
import { useToast } from "@/hooks/use-toast";
import { icd10Api } from "@/lib/api/icd";
import { ppkApi } from "@/lib/api/ppk";
import {
  vclaimApi,
  type SEPLocal,
  type VClaimReferralLocal,
  type VClaimSPRIResponse,
  type SuratKontrolResponse,
} from "@/lib/api/vclaim";
import { type Room } from "@/lib/api/rooms";

// Type for available doctor from schedule
interface AvailableDoctor {
  employee_id: number;
  employee_name: string;
  start_time: string;
  end_time: string;
  max_patients: number;
  consult_fee: number;
}

// Common form data interface
export interface DispositionFormData {
  disposition_type: string;
  disposition_note: string;
  discharge_status: string;
  discharge_condition: string;
  // Referral fields
  referral_facility: string;
  referral_address: string;
  referral_phone: string;
  referral_specialist: string;
  referral_reason: string;
  referral_urgency: string;
  referral_diagnosis: string;
  referral_therapy: string;
  referral_lab_result: string;
  referral_notes: string;
  referral_mode?: "manual" | "bpjs_v1" | "bpjs_v2" | "bpjs_khusus";
  referral_no_rujukan?: string;
  referral_no_sep?: string;
  referral_tgl_rujukan?: string;
  referral_tgl_rencana_kunjungan?: string;
  referral_ppk_code?: string;
  referral_jns_pelayanan?: string;
  referral_tipe_rujukan?: string;
  referral_poli_code?: string;
  referral_diag_code?: string;
  referral_khusus_id?: string;
  referral_khusus_diagnosa_codes?: string;
  referral_khusus_procedure_codes?: string;
  // Admission fields
  admission_type: string;
  admission_reason: string;
  admission_priority: string;
  preferred_class: string;
  special_notes: string;
  // Death fields
  death_time: string;
  death_cause: string;
  // Follow-up fields
  follow_up_date: string;
  follow_up_instruction: string;
  follow_up_room_id?: number;
  follow_up_doctor_id?: number;
  // Discharge fields
  discharge_medication: string;
  discharge_instruction: string;
  // Outpatient transfer fields (UGD → Rawat Jalan)
  outpatient_room_id?: number;
  outpatient_doctor_id?: number;
  transfer_reason?: string;
}

interface FollowUpRegData {
  id: number;
  registration_number: string;
  scheduled_date?: string;
  room_name?: string;
  doctor_name?: string;
  queue_number?: string;
  patient_name?: string;
}

// Props for the discharge drawer (pulang/aps)
interface DischargeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: DispositionFormData;
  onFormChange: (field: string, value: string | number | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
  isDisabled: boolean;
  isInpatient: boolean;
  // Follow-up
  poliRooms: Room[];
  availableDoctors: AvailableDoctor[];
  loadingDoctors: boolean;
  roomClosed: boolean;
  followUpRegData: FollowUpRegData | null;
  // BPJS
  patientNoBpjs: string | null;
  activeSEP: SEPLocal | null;
  patientData: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  } | null;
  visitId: number;
  suratKontrolResult: SuratKontrolResponse | null;
  setSuratKontrolResult: (data: SuratKontrolResponse) => void;
  // Options
  dischargeConditionOptions: { value: string; label: string }[];
  // Surat Kontrol Type Selection
  kontrolType: "none" | "simrs" | "bpjs";
  setKontrolType: (type: "none" | "simrs" | "bpjs") => void;
}

export function DischargeDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
  isInpatient: _isInpatient,
  poliRooms,
  availableDoctors,
  loadingDoctors,
  roomClosed,
  followUpRegData,
  patientNoBpjs,
  activeSEP,
  patientData,
  visitId,
  suratKontrolResult,
  setSuratKontrolResult,
  dischargeConditionOptions,
  kontrolType,
  setKontrolType,
}: DischargeDrawerProps) {
  const isAPS = formData.disposition_type === "aps";
  const showFollowUpFields = !isAPS && kontrolType === "simrs";
  const showBPJSKontrol = !isAPS && kontrolType === "bpjs";
  const showDischargeCondition = isAPS || kontrolType === "none";
  
  // Show SIMRS follow-up form after BPJS Surat Kontrol is created
  const showBPJSFollowUpSync = !isAPS && kontrolType === "bpjs" && !!suratKontrolResult;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            {formData.disposition_type === "pulang" ? (
              <Home className="h-5 w-5 text-green-600" />
            ) : (
              <ExternalLink className="h-5 w-5 text-orange-600" />
            )}
            <div>
              <SheetTitle>
                {formData.disposition_type === "pulang" ? "Pulang" : "Atas Permintaan Sendiri"}
              </SheetTitle>
              <SheetDescription>
                {formData.disposition_type === "pulang"
                  ? "Pasien pulang dalam keadaan baik"
                  : "Pasien pulang atas permintaan sendiri"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {!isAPS && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Jenis Surat Kontrol</Label>
                <RadioGroup
                  value={kontrolType}
                  onValueChange={(value) => setKontrolType(value as "none" | "simrs" | "bpjs")}
                  disabled={isDisabled}
                  className="space-y-2"
                >
                  <label
                    htmlFor="kontrol-none"
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                      kontrolType === "none"
                        ? "border-gray-500 bg-gray-50"
                        : "border-muted hover:border-gray-300",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <RadioGroupItem value="none" id="kontrol-none" className="mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Tidak Ada Kontrol</span>
                      <p className="text-xs text-muted-foreground">
                        Pasien tidak memerlukan jadwal kontrol
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="kontrol-simrs"
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                      kontrolType === "simrs"
                        ? "border-blue-500 bg-blue-50"
                        : "border-muted hover:border-blue-300",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <RadioGroupItem value="simrs" id="kontrol-simrs" className="mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        Surat Kontrol SIMRS (Umum)
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Buat jadwal kunjungan ulang melalui SIMRS untuk pasien umum/non-BPJS
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="kontrol-bpjs"
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                      kontrolType === "bpjs"
                        ? "border-green-500 bg-green-50"
                        : "border-muted hover:border-green-300",
                      isDisabled && "opacity-50 cursor-not-allowed",
                      !patientNoBpjs && "opacity-60"
                    )}
                  >
                    <RadioGroupItem value="bpjs" id="kontrol-bpjs" className="mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-600" />
                        Surat Kontrol BPJS
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Buat surat kontrol melalui bridging BPJS VClaim
                      </p>
                      {!patientNoBpjs && (
                        <p className="text-xs text-amber-600">
                          Pasien belum memiliki nomor BPJS
                        </p>
                      )}
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {isAPS && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>APS tanpa kontrol</AlertTitle>
                <AlertDescription>
                  Untuk APS, form hanya memerlukan kondisi keluar pasien tanpa pembuatan kontrol atau follow-up.
                </AlertDescription>
              </Alert>
            )}

            {/* BPJS Control Section - Surat Kontrol */}
            {showBPJSKontrol && (
              <>
                {patientNoBpjs && activeSEP && patientData ? (
                  <BPJSControlSection
                    dispositionType={formData.disposition_type as "pulang" | "aps"}
                    activeSEP={activeSEP}
                    patient={patientData}
                    visitId={visitId}
                    isDisabled={isDisabled}
                    existingSuratKontrol={suratKontrolResult}
                    onSuratKontrolCreated={(skData) => setSuratKontrolResult(skData)}
                  />
                ) : (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">Tidak Dapat Membuat Surat Kontrol BPJS</AlertTitle>
                    <AlertDescription className="text-amber-600">
                      {!patientNoBpjs ? (
                        <p>Pasien tidak memiliki nomor BPJS. Silakan pilih "Surat Kontrol SIMRS (Umum)" atau lengkapi data BPJS pasien terlebih dahulu.</p>
                      ) : !activeSEP ? (
                        <p>Pasien belum memiliki SEP aktif untuk kunjungan ini. Silakan buat SEP terlebih dahulu atau pilih "Surat Kontrol SIMRS (Umum)".</p>
                      ) : (
                        <p>Data pasien tidak lengkap. Silakan periksa kembali data pasien.</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* SIMRS Follow Up Form - shown after BPJS Surat Kontrol is created */}
            {showBPJSFollowUpSync && (
              <div className="rounded-lg border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold text-sm">Sinkronisasi Jadwal Kontrol SIMRS</span>
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">WAJIB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Surat Kontrol BPJS harus terhubung dengan jadwal kontrol SIMRS. 
                  Pilih poli dan dokter di SIMRS untuk membuat jadwal kontrol.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Tanggal Kontrol (dari BPJS)
                    </Label>
                    <Input
                      type="date"
                      value={suratKontrolResult?.tglRencanaKontrol || formData.follow_up_date}
                      className="h-10 bg-muted"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_room_id_bpjs_sync" className="text-sm">
                      Poli Tujuan SIMRS <span className="text-destructive">*</span>
                    </Label>
                    <Combobox
                      options={poliRooms.map(r => ({ value: r.id.toString(), label: r.name }))}
                      value={formData.follow_up_room_id?.toString() || ""}
                      onValueChange={(value) => {
                        onFormChange("follow_up_room_id", value ? parseInt(value) : undefined);
                        onFormChange("follow_up_doctor_id", undefined);
                        // Also sync the date from BPJS Surat Kontrol
                        if (suratKontrolResult?.tglRencanaKontrol) {
                          onFormChange("follow_up_date", suratKontrolResult.tglRencanaKontrol);
                        }
                      }}
                      placeholder="Pilih poli SIMRS..."
                      searchPlaceholder="Cari poli..."
                      emptyText="Poli tidak ditemukan"
                      disabled={isDisabled}
                    />
                  </div>

                  {/* Doctor Selection */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm">Dokter SIMRS <span className="text-destructive">*</span></Label>
                    {loadingDoctors ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memuat jadwal dokter...</span>
                      </div>
                    ) : roomClosed ? (
                      <Alert variant="destructive" className="bg-red-50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Poli tutup pada tanggal ini. Silakan pilih poli lain atau hubungi admin.
                        </AlertDescription>
                      </Alert>
                    ) : availableDoctors.length === 0 && formData.follow_up_room_id ? (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700">
                          Tidak ada dokter yang praktik pada tanggal ini di poli yang dipilih.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableDoctors.map((doctor) => (
                          <button
                            key={doctor.employee_id}
                            type="button"
                            onClick={() => onFormChange("follow_up_doctor_id", doctor.employee_id)}
                            disabled={isDisabled}
                            className={cn(
                              "p-3 rounded-lg border-2 text-left transition-all",
                              formData.follow_up_doctor_id === doctor.employee_id
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                : "border-muted hover:border-primary/50 hover:bg-muted/30"
                            )}
                          >
                            <div className="font-medium text-sm">{doctor.employee_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Jam praktik: {doctor.start_time} - {doctor.end_time}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Follow Up Form */}
            {showFollowUpFields && (
              <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold text-sm">Jadwal Kontrol</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_date_drawer" className="text-sm">
                      Tanggal Kontrol <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="follow_up_date_drawer"
                      type="date"
                      value={formData.follow_up_date}
                      onChange={(e) => onFormChange("follow_up_date", e.target.value)}
                      className="h-10 bg-background"
                      min={new Date().toISOString().split('T')[0]}
                      disabled={isDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_room_id_drawer" className="text-sm">
                      Poli Tujuan <span className="text-destructive">*</span>
                    </Label>
                    <Combobox
                      options={poliRooms.map(r => ({ value: r.id.toString(), label: r.name }))}
                      value={formData.follow_up_room_id?.toString() || ""}
                      onValueChange={(value) => {
                        onFormChange("follow_up_room_id", value ? parseInt(value) : undefined);
                        onFormChange("follow_up_doctor_id", undefined);
                      }}
                      placeholder="Pilih poli..."
                      searchPlaceholder="Cari poli..."
                      emptyText="Poli tidak ditemukan"
                      disabled={isDisabled}
                    />
                  </div>

                  {/* Doctor Selection */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm">Dokter <span className="text-destructive">*</span></Label>
                    {loadingDoctors ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memuat jadwal dokter...</span>
                      </div>
                    ) : roomClosed ? (
                      <Alert variant="destructive" className="bg-red-50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Poli tutup pada tanggal ini. Silakan pilih tanggal lain.
                        </AlertDescription>
                      </Alert>
                    ) : availableDoctors.length === 0 && formData.follow_up_room_id && formData.follow_up_date ? (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700">
                          Tidak ada dokter yang praktik pada tanggal ini.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableDoctors.map((doctor) => (
                          <button
                            key={doctor.employee_id}
                            type="button"
                            onClick={() => onFormChange("follow_up_doctor_id", doctor.employee_id)}
                            disabled={isDisabled}
                            className={cn(
                              "p-3 rounded-lg border-2 text-left transition-all",
                              formData.follow_up_doctor_id === doctor.employee_id
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                : "border-muted hover:border-primary/50 hover:bg-muted/30"
                            )}
                          >
                            <div className="font-medium text-sm">{doctor.employee_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Jam praktik: {doctor.start_time} - {doctor.end_time}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="follow_up_instruction_drawer" className="text-sm">Instruksi Kontrol</Label>
                    <Textarea
                      id="follow_up_instruction_drawer"
                      placeholder="Rencana pemeriksaan/tindakan saat kontrol..."
                      value={formData.follow_up_instruction}
                      onChange={(e) => onFormChange("follow_up_instruction", e.target.value)}
                      className="min-h-[80px] resize-none bg-background"
                      disabled={isDisabled}
                    />
                  </div>
                </div>

                {/* Show QR Code if follow-up already created */}
                {followUpRegData && (
                  <Alert className="bg-blue-50 border-blue-300">
                    <QrCode className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-700">Jadwal Kontrol Terdaftar</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      <div className="flex items-start gap-4 mt-2">
                        <div className="space-y-1 flex-1">
                          <p>No. Registrasi: <strong>{followUpRegData.registration_number}</strong></p>
                          {followUpRegData.scheduled_date && (
                            <p>Tanggal: <strong>{new Date(followUpRegData.scheduled_date).toLocaleDateString("id-ID")}</strong></p>
                          )}
                          {followUpRegData.room_name && <p>Poli: <strong>{followUpRegData.room_name}</strong></p>}
                          {followUpRegData.doctor_name && <p>Dokter: <strong>{followUpRegData.doctor_name}</strong></p>}
                        </div>
                        <div className="flex-shrink-0">
                          <CheckInQRCode
                            registrationId={followUpRegData.id}
                            registrationNumber={followUpRegData.registration_number}
                            patientName={followUpRegData.patient_name || "Pasien"}
                            scheduledDate={followUpRegData.scheduled_date}
                            roomName={followUpRegData.room_name}
                            doctorName={followUpRegData.doctor_name}
                            queueNumber={followUpRegData.queue_number}
                          />
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Discharge Condition */}
            {showDischargeCondition && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Kondisi Keluar</Label>
                <Combobox
                  options={dischargeConditionOptions}
                  value={formData.discharge_condition}
                  onValueChange={(value) => onFormChange("discharge_condition", value)}
                  placeholder="Pilih kondisi keluar..."
                  searchPlaceholder="Cari kondisi..."
                  emptyText="Kondisi tidak ditemukan"
                  disabled={isDisabled}
                />
              </div>
            )}

            {/* Discharge Instructions */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Instruksi Pemulangan</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discharge_instruction_drawer" className="text-sm">
                  Instruksi untuk Pasien
                </Label>
                <Textarea
                  id="discharge_instruction_drawer"
                  placeholder="Instruksi yang harus diikuti pasien setelah pulang..."
                  value={formData.discharge_instruction}
                  onChange={(e) => onFormChange("discharge_instruction", e.target.value)}
                  className="min-h-[100px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discharge_medication_drawer" className="text-sm">
                  Obat Pulang
                </Label>
                <Textarea
                  id="discharge_medication_drawer"
                  placeholder="Daftar obat yang dibawa pulang beserta aturan pakai..."
                  value={formData.discharge_medication}
                  onChange={(e) => onFormChange("discharge_medication", e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isDisabled}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving || isDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan & Pulangkan
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Props for admission drawer (rawat_inap)
interface AdmissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: DispositionFormData;
  onFormChange: (field: string, value: string | number | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
  isDisabled: boolean;
  // BPJS
  patientNoBpjs: string | null;
  activeSEP: SEPLocal | null;
  patientData: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  } | null;
  visitId: number;
  spriResult: VClaimSPRIResponse | null;
  setSpriResult: (data: VClaimSPRIResponse) => void;
  // Options
  inpatientClassOptions: { value: string; label: string }[];
  // SPRI Type Selection
  spriType: "simrs" | "bpjs";
  setSpriType: (type: "simrs" | "bpjs") => void;
}

export function AdmissionDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
  patientNoBpjs,
  activeSEP,
  patientData,
  visitId,
  spriResult,
  setSpriResult,
  inpatientClassOptions,
  spriType,
  setSpriType,
}: AdmissionDrawerProps) {
  const hasBPJSSPRI = !!spriResult;
  const showBPJSSPRI = spriType === "bpjs";
  const showSIMRSForm = spriType === "simrs";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Hospital className="h-5 w-5 text-blue-600" />
            <div>
              <SheetTitle>Rawat Inap</SheetTitle>
              <SheetDescription>Pasien memerlukan rawat inap</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Pilihan Jenis Rawat Inap */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Jenis Rawat Inap</Label>
              <RadioGroup
                value={spriType}
                onValueChange={(value) => setSpriType(value as "simrs" | "bpjs")}
                disabled={isDisabled}
                className="space-y-2"
              >
                <label
                  htmlFor="spri-simrs"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    spriType === "simrs"
                      ? "border-blue-500 bg-blue-50"
                      : "border-muted hover:border-blue-300",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="simrs" id="spri-simrs" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Hospital className="h-4 w-4 text-blue-600" />
                      Rawat Inap SIMRS (Umum)
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Permintaan rawat inap untuk pasien umum/non-BPJS melalui SIMRS
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="spri-bpjs"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    spriType === "bpjs"
                      ? "border-green-500 bg-green-50"
                      : "border-muted hover:border-green-300",
                    isDisabled && "opacity-50 cursor-not-allowed",
                    !patientNoBpjs && "opacity-60"
                  )}
                >
                  <RadioGroupItem value="bpjs" id="spri-bpjs" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Hospital className="h-4 w-4 text-green-600" />
                      SPRI BPJS
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Surat Permintaan Rawat Inap melalui bridging BPJS VClaim
                    </p>
                    {!patientNoBpjs && (
                      <p className="text-xs text-amber-600">
                        Pasien belum memiliki nomor BPJS
                      </p>
                    )}
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* BPJS Control Section - SPRI (tidak memerlukan SEP) */}
            {showBPJSSPRI && (
              <>
                {patientNoBpjs && patientData ? (
                  <BPJSControlSection
                    dispositionType="rawat_inap"
                    activeSEP={activeSEP}
                    patient={patientData}
                    visitId={visitId}
                    isDisabled={isDisabled}
                    existingSPRI={spriResult}
                    onSPRICreated={(spriData) => setSpriResult(spriData)}
                  />
                ) : (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">Tidak Dapat Membuat SPRI BPJS</AlertTitle>
                    <AlertDescription className="text-amber-600">
                      {!patientNoBpjs ? (
                        <p>Pasien tidak memiliki nomor BPJS. Silakan pilih "Rawat Inap SIMRS (Umum)" atau lengkapi data BPJS pasien terlebih dahulu.</p>
                      ) : (
                        <p>Data pasien tidak lengkap. Silakan periksa kembali data pasien.</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Show admission form for SIMRS */}
            {showSIMRSForm && (
              <>
                <Alert className="bg-blue-50 border-blue-200">
                  <Send className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    Permintaan rawat inap akan dikirim ke bagian <strong>Pendaftaran/Admisi</strong> untuk pemilihan kamar, bed, dan DPJP.
                  </AlertDescription>
                </Alert>

                {/* Admission Type Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Tipe Rawat Inap <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: "elektif", label: "Elektif", desc: "Rawat inap terencana" },
                      { value: "emergency", label: "Emergency", desc: "Rawat inap darurat" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onFormChange("admission_type", opt.value)}
                        disabled={isDisabled}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all",
                          formData.admission_type === opt.value
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Prioritas <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { value: "normal", label: "Normal", desc: "Prioritas standar", color: "text-green-600" },
                      { value: "urgent", label: "Urgent", desc: "Perlu segera", color: "text-orange-600" },
                      { value: "emergency", label: "Emergency", desc: "Sangat mendesak", color: "text-red-600" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onFormChange("admission_priority", opt.value)}
                        disabled={isDisabled}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all",
                          formData.admission_priority === opt.value
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn("font-semibold text-sm", opt.color)}>{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred Class */}
                <div className="space-y-2">
                  <Label className="text-sm">Kelas Kamar yang Diinginkan</Label>
                  <Combobox
                    options={inpatientClassOptions}
                    value={formData.preferred_class || ""}
                    onValueChange={(value) => onFormChange("preferred_class", value)}
                    placeholder="Pilih kelas kamar..."
                    searchPlaceholder="Cari kelas..."
                    emptyText="Tidak ada kelas"
                    disabled={isDisabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opsional. Bagian admisi akan menyesuaikan dengan ketersediaan kamar.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    Alasan/Indikasi Rawat Inap <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Jelaskan alasan klinis pasien perlu dirawat inap..."
                    value={formData.admission_reason}
                    onChange={(e) => onFormChange("admission_reason", e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={isDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Catatan Khusus</Label>
                  <Textarea
                    placeholder="Catatan khusus untuk bagian admisi (misal: perlu ruang isolasi, pasien bariatrik, dll)..."
                    value={formData.special_notes || ""}
                    onChange={(e) => onFormChange("special_notes", e.target.value)}
                    className="min-h-[80px] resize-none"
                    disabled={isDisabled}
                  />
                </div>
              </>
            )}

            {/* Show success message and admission form when SPRI is created */}
            {hasBPJSSPRI && (
              <>
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700">SPRI Berhasil Dibuat</AlertTitle>
                  <AlertDescription className="text-green-600">
                    <p>No. SPRI: <strong>{spriResult.noSPRI}</strong></p>
                    <p className="mt-2 text-sm">
                      Lengkapi data rawat inap di bawah untuk membuat Permintaan Rawat Inap ke Admisi.
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Admission Form Fields for BPJS SPRI */}
                <div className="rounded-lg border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Send className="h-4 w-4" />
                    <span className="font-semibold text-sm">Data Permintaan Rawat Inap SIMRS</span>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">WAJIB</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data ini diperlukan untuk membuat permintaan rawat inap di SIMRS yang terhubung dengan SPRI BPJS.
                  </p>

                  {/* Admission Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Tipe Rawat Inap <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { value: "elektif", label: "Elektif", desc: "Rawat inap terencana" },
                        { value: "emergency", label: "Emergency", desc: "Rawat inap darurat" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onFormChange("admission_type", opt.value)}
                          disabled={isDisabled}
                          className={cn(
                            "p-4 rounded-lg border-2 text-left transition-all",
                            formData.admission_type === opt.value
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-muted hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className="font-semibold text-sm">{opt.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Prioritas <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "normal", label: "Normal", desc: "Prioritas standar", color: "text-green-600" },
                        { value: "urgent", label: "Urgent", desc: "Perlu segera", color: "text-orange-600" },
                        { value: "emergency", label: "Emergency", desc: "Sangat mendesak", color: "text-red-600" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onFormChange("admission_priority", opt.value)}
                          disabled={isDisabled}
                          className={cn(
                            "p-4 rounded-lg border-2 text-left transition-all",
                            formData.admission_priority === opt.value
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-muted hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn("font-semibold text-sm", opt.color)}>{opt.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred Class */}
                  <div className="space-y-2">
                    <Label className="text-sm">Kelas Kamar yang Diinginkan</Label>
                    <Combobox
                      options={inpatientClassOptions}
                      value={formData.preferred_class || ""}
                      onValueChange={(value) => onFormChange("preferred_class", value)}
                      placeholder="Pilih kelas kamar..."
                      searchPlaceholder="Cari kelas..."
                      emptyText="Tidak ada kelas"
                      disabled={isDisabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      Opsional. Bagian admisi akan menyesuaikan dengan ketersediaan kamar.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">
                      Alasan/Indikasi Rawat Inap <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      placeholder="Jelaskan alasan klinis pasien perlu dirawat inap..."
                      value={formData.admission_reason}
                      onChange={(e) => onFormChange("admission_reason", e.target.value)}
                      className="min-h-[100px] resize-none bg-background"
                      disabled={isDisabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Catatan Khusus</Label>
                    <Textarea
                      placeholder="Catatan khusus untuk bagian admisi (misal: perlu ruang isolasi, pasien bariatrik, dll)..."
                      value={formData.special_notes || ""}
                      onChange={(e) => onFormChange("special_notes", e.target.value)}
                      className="min-h-[80px] resize-none bg-background"
                      disabled={isDisabled}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving || isDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {hasBPJSSPRI ? "Simpan Disposisi" : "Kirim Permintaan"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Props for referral drawer (rujuk)
interface ReferralDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: DispositionFormData;
  onFormChange: (field: string, value: string | number | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
  isDisabled: boolean;
  visitId: number;
  registrationId?: number;
  activeSEP: SEPLocal | null;
  patientData: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  } | null;
}

export function ReferralDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
  visitId,
  registrationId,
  activeSEP,
  patientData,
}: ReferralDrawerProps) {
  const { toast } = useToast();
  const referralMode = formData.referral_mode || "manual";
  const [ppkOptions, setPpkOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingPPK, setLoadingPPK] = useState(false);
  const [bpjsSubmitting, setBpjsSubmitting] = useState(false);
  const [bpjsReferral, setBpjsReferral] = useState<VClaimReferralLocal | null>(null);
  const [ppkDialogOpen, setPpkDialogOpen] = useState(false);
  const [ppkSaving, setPpkSaving] = useState(false);
  const [diagnosaModalOpen, setDiagnosaModalOpen] = useState(false);
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [selectedDiagnosaNama, setSelectedDiagnosaNama] = useState("");
  const [selectedPoliNama, setSelectedPoliNama] = useState("");
  const [ppkForm, setPpkForm] = useState({ kode_bpjs: "", nama: "", alamat: "", telepon: "" });

  const selectedPPKName = useMemo(() => {
    return ppkOptions.find((p) => p.value === (formData.referral_ppk_code || ""))?.label || "";
  }, [ppkOptions, formData.referral_ppk_code]);

  const loadPPK = async () => {
    setLoadingPPK(true);
    try {
      const res = await ppkApi.getAll({ active: true, limit: 1000 });
      const items = res.data.data || [];
      setPpkOptions(items.map((item) => ({ value: item.kode_bpjs, label: `${item.kode_bpjs} - ${item.nama}` })));
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat master PPK." });
    } finally {
      setLoadingPPK(false);
    }
  };

  const loadExistingReferral = async () => {
    if (!visitId) return;
    try {
      const res = await vclaimApi.getRujukanByVisit(visitId);
      const local = res.data.data;
      setBpjsReferral(local);
      onFormChange("referral_no_rujukan", local.no_rujukan || "");
      onFormChange("referral_no_sep", local.no_sep || "");
      onFormChange("referral_tgl_rujukan", local.tgl_rujukan || "");
      onFormChange("referral_tgl_rencana_kunjungan", local.tgl_rencana_kunjungan || "");
      onFormChange("referral_ppk_code", local.ppk_dirujuk || "");
      onFormChange("referral_jns_pelayanan", local.jns_pelayanan || "2");
      onFormChange("referral_tipe_rujukan", local.tipe_rujukan || "0");
      onFormChange("referral_poli_code", local.poli_rujukan || "");
      onFormChange("referral_diag_code", local.diag_rujukan || "");
      setSelectedPoliNama(local.poli_rujukan_nama || "");
      setSelectedDiagnosaNama(local.diag_rujukan_nama || "");
      onFormChange("referral_khusus_id", local.khusus_id_rujukan || "");
      onFormChange("referral_khusus_diagnosa_codes", local.khusus_diagnosa_codes || "");
      onFormChange("referral_khusus_procedure_codes", local.khusus_procedure_codes || "");
      if (!formData.referral_mode && (local.version === "v1" || local.version === "v2")) {
        onFormChange("referral_mode", local.version === "v1" ? "bpjs_v1" : "bpjs_v2");
      }
    } catch {
      setBpjsReferral(null);
      setSelectedPoliNama("");
      setSelectedDiagnosaNama("");
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!formData.referral_mode) {
      onFormChange("referral_mode", activeSEP?.no_sep ? "bpjs_v2" : "manual");
    }
    if (!formData.referral_no_sep && activeSEP?.no_sep) {
      onFormChange("referral_no_sep", activeSEP.no_sep);
    }
    if (!formData.referral_tgl_rujukan) {
      onFormChange("referral_tgl_rujukan", new Date().toISOString().split("T")[0]);
    }
    loadPPK();
    loadExistingReferral();
  }, [open, visitId]);

  const searchReferralDiagnosa = async (keyword: string) => {
    try {
      const res = await icd10Api.search({
        search: keyword,
        limit: 50,
        valid_only: true,
      });
      return (res || []).map((item) => ({ kode: item.code, nama: item.display }));
    } catch {
      return [];
    }
  };

  const searchReferralPoliSpesialistik = async (keyword: string) => {
    if (!formData.referral_ppk_code) {
      toast({
        variant: "destructive",
        title: "PPK belum dipilih",
        description: "Pilih PPK dirujuk terlebih dahulu sebelum mencari kode poli.",
      });
      return [];
    }

    if (!formData.referral_tgl_rujukan) {
      toast({
        variant: "destructive",
        title: "Tanggal rujukan belum diisi",
        description: "Isi tanggal rujukan untuk mengambil list spesialistik BPJS.",
      });
      return [];
    }

    try {
      const res = await vclaimApi.getRujukanSpesialistik(
        formData.referral_ppk_code,
        formData.referral_tgl_rujukan,
        keyword || undefined,
      );
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const savePPK = async () => {
    if (!ppkForm.kode_bpjs.trim() || !ppkForm.nama.trim()) {
      toast({ variant: "destructive", title: "Validasi", description: "Kode BPJS dan nama PPK wajib diisi." });
      return;
    }

    setPpkSaving(true);
    try {
      const res = await ppkApi.create({
        kode_bpjs: ppkForm.kode_bpjs.trim(),
        nama: ppkForm.nama.trim(),
        alamat: ppkForm.alamat.trim(),
        telepon: ppkForm.telepon.trim(),
        is_active: true,
      });
      const created = res.data.data;
      setPpkDialogOpen(false);
      setPpkForm({ kode_bpjs: "", nama: "", alamat: "", telepon: "" });
      await loadPPK();
      onFormChange("referral_ppk_code", created.kode_bpjs);
      onFormChange("referral_facility", created.nama);
      toast({ title: "Berhasil", description: "PPK baru berhasil ditambahkan." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err?.response?.data?.error || "Gagal menambah PPK.",
      });
    } finally {
      setPpkSaving(false);
    }
  };

  const createOrUpdateBPJSReferral = async () => {
    if (!activeSEP?.no_sep && !formData.referral_no_sep) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "SEP aktif tidak ditemukan." });
      return;
    }
    if (!formData.referral_ppk_code) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "PPK tujuan wajib dipilih." });
      return;
    }
    if (!formData.referral_diag_code) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Kode diagnosis rujukan wajib diisi." });
      return;
    }
    if (!formData.referral_tgl_rujukan) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Tanggal rujukan wajib diisi." });
      return;
    }
    if (formData.referral_tipe_rujukan !== "2" && !formData.referral_poli_code) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Poli rujukan wajib diisi untuk tipe 0/1." });
      return;
    }
    if (referralMode === "bpjs_v2" && !formData.referral_tgl_rencana_kunjungan) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Tanggal rencana kunjungan wajib diisi untuk V2." });
      return;
    }

    setBpjsSubmitting(true);
    try {
      const basePayload = {
        no_sep: formData.referral_no_sep || activeSEP?.no_sep || "",
        visit_id: visitId,
        registration_id: registrationId || activeSEP?.registration_id,
        patient_id: patientData?.id,
        sep_id: activeSEP?.id,
        tgl_rujukan: formData.referral_tgl_rujukan,
        ppk_dirujuk: formData.referral_ppk_code,
        jns_pelayanan: formData.referral_jns_pelayanan || "2",
        catatan: formData.referral_reason || "",
        diag_rujukan: formData.referral_diag_code,
        tipe_rujukan: formData.referral_tipe_rujukan || "0",
        poli_rujukan: formData.referral_tipe_rujukan === "2" ? "" : (formData.referral_poli_code || ""),
      };

      let noRujukan = formData.referral_no_rujukan || "";
      if (referralMode === "bpjs_v1") {
        if (noRujukan) {
          await vclaimApi.updateRujukanV1(noRujukan, basePayload);
        } else {
          const res = await vclaimApi.createRujukanV1(basePayload);
          noRujukan = res.data.data?.noRujukan || "";
        }
      }

      if (referralMode === "bpjs_v2") {
        const payload = {
          ...basePayload,
          tgl_rencana_kunjungan: formData.referral_tgl_rencana_kunjungan || "",
        };
        if (noRujukan) {
          await vclaimApi.updateRujukanV2(noRujukan, payload);
        } else {
          const res = await vclaimApi.createRujukanV2(payload);
          noRujukan = res.data.data?.noRujukan || "";
        }
      }

      if (noRujukan) {
        onFormChange("referral_no_rujukan", noRujukan);
      }
      onFormChange("referral_facility", selectedPPKName || formData.referral_facility || "");
      onFormChange("referral_reason", formData.referral_reason || "");
      onFormChange(
        "referral_diagnosis",
        selectedDiagnosaNama
          ? `${formData.referral_diag_code || ""} - ${selectedDiagnosaNama}`
          : (formData.referral_diag_code || ""),
      );
      onFormChange("referral_specialist", selectedPoliNama || formData.referral_specialist || "");
      await loadExistingReferral();

      toast({ title: "Berhasil", description: "Rujukan BPJS berhasil disimpan." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err?.response?.data?.error || "Gagal menyimpan rujukan BPJS.",
      });
    } finally {
      setBpjsSubmitting(false);
    }
  };

  const createRujukanKhusus = async () => {
    if (!formData.referral_no_rujukan) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Nomor rujukan wajib diisi untuk rujukan khusus." });
      return;
    }

    const diagnosaCodes = (formData.referral_khusus_diagnosa_codes || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const procedureCodes = (formData.referral_khusus_procedure_codes || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!diagnosaCodes.length) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Minimal satu kode diagnosis khusus wajib diisi." });
      return;
    }

    setBpjsSubmitting(true);
    try {
      await vclaimApi.createRujukanKhusus({
        no_rujukan: formData.referral_no_rujukan,
        diagnosa_codes: diagnosaCodes,
        procedure_codes: procedureCodes,
      });
      await loadExistingReferral();
      toast({ title: "Berhasil", description: "Rujukan khusus BPJS berhasil dibuat." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err?.response?.data?.error || "Gagal membuat rujukan khusus.",
      });
    } finally {
      setBpjsSubmitting(false);
    }
  };

  const deleteReferral = async () => {
    if (!formData.referral_no_rujukan) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "Nomor rujukan belum tersedia." });
      return;
    }
    setBpjsSubmitting(true);
    try {
      await vclaimApi.deleteRujukan(formData.referral_no_rujukan);
      onFormChange("referral_no_rujukan", "");
      onFormChange("referral_khusus_id", "");
      setBpjsReferral(null);
      toast({ title: "Berhasil", description: "Rujukan BPJS berhasil dihapus." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err?.response?.data?.error || "Gagal menghapus rujukan.",
      });
    } finally {
      setBpjsSubmitting(false);
    }
  };

  const deleteRujukanKhusus = async () => {
    if (!formData.referral_khusus_id || !formData.referral_no_rujukan) {
      toast({ variant: "destructive", title: "Data tidak lengkap", description: "ID khusus atau nomor rujukan belum tersedia." });
      return;
    }
    setBpjsSubmitting(true);
    try {
      await vclaimApi.deleteRujukanKhusus({
        id_rujukan: formData.referral_khusus_id,
        no_rujukan: formData.referral_no_rujukan,
      });
      onFormChange("referral_khusus_id", "");
      await loadExistingReferral();
      toast({ title: "Berhasil", description: "Rujukan khusus BPJS berhasil dihapus." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err?.response?.data?.error || "Gagal menghapus rujukan khusus.",
      });
    } finally {
      setBpjsSubmitting(false);
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Ambulance className="h-5 w-5 text-amber-600" />
            <div>
              <SheetTitle>Rujuk</SheetTitle>
              <SheetDescription>Pasien dirujuk ke fasilitas kesehatan lain</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Mode Rujukan</Label>
              <RadioGroup
                value={referralMode}
                onValueChange={(value) => onFormChange("referral_mode", value)}
                disabled={isDisabled}
                className="space-y-2"
              >
                <label
                  htmlFor="mode-manual"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    referralMode === "manual"
                      ? "border-amber-500 bg-amber-50"
                      : "border-muted hover:border-amber-300",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="manual" id="mode-manual" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Manual SIMRS</span>
                    <p className="text-xs text-muted-foreground">Rujukan internal SIMRS tanpa bridging BPJS.</p>
                  </div>
                </label>

                <label
                  htmlFor="mode-v1"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    referralMode === "bpjs_v1"
                      ? "border-blue-500 bg-blue-50"
                      : "border-muted hover:border-blue-300",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="bpjs_v1" id="mode-v1" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">BPJS V1</span>
                    <p className="text-xs text-muted-foreground">Rujukan VClaim versi 1 untuk alur BPJS.</p>
                  </div>
                </label>

                <label
                  htmlFor="mode-v2"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    referralMode === "bpjs_v2"
                      ? "border-green-500 bg-green-50"
                      : "border-muted hover:border-green-300",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="bpjs_v2" id="mode-v2" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">BPJS V2</span>
                    <p className="text-xs text-muted-foreground">Rujukan VClaim versi 2 dengan rencana kunjungan.</p>
                  </div>
                </label>

                <label
                  htmlFor="mode-khusus"
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    referralMode === "bpjs_khusus"
                      ? "border-purple-500 bg-purple-50"
                      : "border-muted hover:border-purple-300",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="bpjs_khusus" id="mode-khusus" className="mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">BPJS Khusus</span>
                    <p className="text-xs text-muted-foreground">Rujukan khusus untuk kasus/prosedur tertentu BPJS.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {(referralMode === "bpjs_v1" || referralMode === "bpjs_v2" || referralMode === "bpjs_khusus") && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-700">Rujukan BPJS VClaim</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Pisahkan rujukan sesuai mode. Gunakan tombol simpan rujukan BPJS sebelum menyimpan disposisi pulang.
                </AlertDescription>
              </Alert>
            )}

            {referralMode === "manual" && (
            <div className="rounded-lg border bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Ambulance className="h-4 w-4" />
                <span className="font-semibold text-sm">Rujukan Manual SIMRS</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  Fasilitas Tujuan Rujukan <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Nama rumah sakit/fasilitas kesehatan tujuan"
                  value={formData.referral_facility}
                  onChange={(e) => onFormChange("referral_facility", e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Spesialis Tujuan</Label>
                <Input
                  placeholder="Contoh: Sp.PD, Sp.JP, Sp.B, dll"
                  value={formData.referral_specialist}
                  onChange={(e) => onFormChange("referral_specialist", e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Alamat Fasilitas</Label>
                <Input
                  placeholder="Alamat lengkap fasilitas tujuan"
                  value={formData.referral_address}
                  onChange={(e) => onFormChange("referral_address", e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Telepon Fasilitas</Label>
                <Input
                  placeholder="Nomor telepon fasilitas"
                  value={formData.referral_phone}
                  onChange={(e) => onFormChange("referral_phone", e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Urgensi Rujukan</Label>
                <Combobox
                  options={[
                    { value: "cito", label: "CITO" },
                    { value: "urgent", label: "Urgent" },
                    { value: "elektif", label: "Elektif" },
                  ]}
                  value={formData.referral_urgency}
                  onValueChange={(value) => onFormChange("referral_urgency", value)}
                  placeholder="Pilih urgensi..."
                  searchPlaceholder="Cari..."
                  emptyText="Tidak ditemukan"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">
                  Alasan Rujukan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Alasan pasien dirujuk ke fasilitas lain..."
                  value={formData.referral_reason}
                  onChange={(e) => onFormChange("referral_reason", e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">Diagnosis / Ringkasan Klinis</Label>
                <Textarea
                  placeholder="Diagnosis dan ringkasan kondisi klinis pasien..."
                  value={formData.referral_diagnosis}
                  onChange={(e) => onFormChange("referral_diagnosis", e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">Terapi yang Sudah Diberikan</Label>
                <Textarea
                  placeholder="Terapi dan tindakan yang sudah dilakukan..."
                  value={formData.referral_therapy}
                  onChange={(e) => onFormChange("referral_therapy", e.target.value)}
                  className="min-h-[60px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">Hasil Pemeriksaan Penunjang</Label>
                <Textarea
                  placeholder="Hasil lab, radiologi, atau pemeriksaan penunjang lainnya..."
                  value={formData.referral_lab_result}
                  onChange={(e) => onFormChange("referral_lab_result", e.target.value)}
                  className="min-h-[60px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">Catatan Tambahan untuk RS Tujuan</Label>
                <Textarea
                  placeholder="Catatan tambahan yang perlu diketahui RS tujuan..."
                  value={formData.referral_notes}
                  onChange={(e) => onFormChange("referral_notes", e.target.value)}
                  className="min-h-[60px] resize-none"
                  disabled={isDisabled}
                />
              </div>
            </div>
            </div>
            )}

            {(referralMode === "bpjs_v1" || referralMode === "bpjs_v2") && (
              <div className="rounded-lg border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Send className="h-4 w-4" />
                  <span className="font-semibold text-sm">Rujukan BPJS {referralMode === "bpjs_v1" ? "V1" : "V2"}</span>
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">WAJIB BPJS</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Nomor SEP</Label>
                    <Input
                      value={formData.referral_no_sep || activeSEP?.no_sep || ""}
                      onChange={(e) => onFormChange("referral_no_sep", e.target.value)}
                      disabled={isDisabled}
                      placeholder="Nomor SEP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Nomor Rujukan</Label>
                    <Input value={formData.referral_no_rujukan || ""} onChange={(e) => onFormChange("referral_no_rujukan", e.target.value)} disabled={isDisabled} placeholder="Terisi setelah create" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Tanggal Rujukan</Label>
                    <Input
                      type="date"
                      value={formData.referral_tgl_rujukan || ""}
                      onChange={(e) => onFormChange("referral_tgl_rujukan", e.target.value)}
                      disabled={isDisabled}
                    />
                  </div>
                  {referralMode === "bpjs_v2" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Tgl Rencana Kunjungan</Label>
                      <Input
                        type="date"
                        value={formData.referral_tgl_rencana_kunjungan || ""}
                        onChange={(e) => onFormChange("referral_tgl_rencana_kunjungan", e.target.value)}
                        disabled={isDisabled}
                      />
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">PPK Dirujuk</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPpkDialogOpen(true)} disabled={isDisabled}>
                        <Plus className="h-4 w-4 mr-1" /> Tambah PPK
                      </Button>
                    </div>
                    <Combobox
                      options={ppkOptions}
                      value={formData.referral_ppk_code || ""}
                      onValueChange={(value) => {
                        onFormChange("referral_ppk_code", value);
                        const label = ppkOptions.find((p) => p.value === value)?.label || "";
                        onFormChange("referral_facility", label);
                      }}
                      placeholder={loadingPPK ? "Memuat PPK..." : "Pilih PPK tujuan..."}
                      searchPlaceholder="Cari PPK..."
                      emptyText="PPK tidak ditemukan"
                      disabled={isDisabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Jenis Pelayanan</Label>
                    <Combobox
                      options={[{ value: "1", label: "Rawat Inap" }, { value: "2", label: "Rawat Jalan" }]}
                      value={formData.referral_jns_pelayanan || "2"}
                      onValueChange={(value) => onFormChange("referral_jns_pelayanan", value)}
                      placeholder="Pilih jenis pelayanan"
                      searchPlaceholder="Cari..."
                      emptyText="Tidak ada opsi"
                      disabled={isDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Tipe Rujukan</Label>
                    <Combobox
                      options={[{ value: "0", label: "Penuh" }, { value: "1", label: "Partial" }, { value: "2", label: "Rujuk Balik" }]}
                      value={formData.referral_tipe_rujukan || "0"}
                      onValueChange={(value) => onFormChange("referral_tipe_rujukan", value)}
                      placeholder="Pilih tipe"
                      searchPlaceholder="Cari..."
                      emptyText="Tidak ada opsi"
                      disabled={isDisabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Kode Diagnosa Rujukan</Label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedDiagnosaNama
                          ? `${formData.referral_diag_code || ""} - ${selectedDiagnosaNama}`
                          : (formData.referral_diag_code || "")}
                        readOnly
                        disabled={isDisabled}
                        placeholder="Pilih kode diagnosa dari master SIMRS"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDiagnosaModalOpen(true)}
                        disabled={isDisabled}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Sumber data: master ICD-10 SIMRS.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Kode Poli Rujukan</Label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedPoliNama
                          ? `${formData.referral_poli_code || ""} - ${selectedPoliNama}`
                          : (formData.referral_poli_code || "")}
                        readOnly
                        disabled={isDisabled || formData.referral_tipe_rujukan === "2"}
                        placeholder={formData.referral_tipe_rujukan === "2" ? "Kosong untuk tipe 2" : "Pilih dari list spesialistik BPJS"}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPoliModalOpen(true)}
                        disabled={isDisabled || formData.referral_tipe_rujukan === "2"}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Sumber data: list spesialistik rujukan BPJS (berdasarkan PPK dan tanggal rujukan).</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Catatan Rujukan</Label>
                  <Textarea
                    value={formData.referral_reason}
                    onChange={(e) => onFormChange("referral_reason", e.target.value)}
                    className="min-h-[70px]"
                    placeholder="Catatan klinis rujukan"
                    disabled={isDisabled}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={createOrUpdateBPJSReferral} disabled={isDisabled || bpjsSubmitting}>
                    {bpjsSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {formData.referral_no_rujukan ? "Update Rujukan BPJS" : "Buat Rujukan BPJS"}
                  </Button>
                  <Button type="button" variant="destructive" onClick={deleteReferral} disabled={isDisabled || bpjsSubmitting || !formData.referral_no_rujukan}>
                    Hapus Rujukan BPJS
                  </Button>
                </div>
              </div>
            )}

            {referralMode === "bpjs_khusus" && (
              <div className="rounded-lg border-2 border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Send className="h-4 w-4" />
                  <span className="font-semibold text-sm">Rujukan Khusus BPJS</span>
                  <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">KHUSUS</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm">Nomor Rujukan Dasar</Label>
                    <Input
                      value={formData.referral_no_rujukan || ""}
                      onChange={(e) => onFormChange("referral_no_rujukan", e.target.value)}
                      disabled={isDisabled}
                      placeholder="No rujukan dari V1/V2"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm">Kode Diagnosis Khusus</Label>
                    <Input
                      value={formData.referral_khusus_diagnosa_codes || ""}
                      onChange={(e) => onFormChange("referral_khusus_diagnosa_codes", e.target.value)}
                      disabled={isDisabled}
                      placeholder="Pisahkan dengan koma, contoh: primer;Z49.1,sekunder;I10"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm">Kode Prosedur Khusus</Label>
                    <Input
                      value={formData.referral_khusus_procedure_codes || ""}
                      onChange={(e) => onFormChange("referral_khusus_procedure_codes", e.target.value)}
                      disabled={isDisabled}
                      placeholder="Pisahkan dengan koma, contoh: 95.04,89.12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">ID Rujukan Khusus</Label>
                    <Input
                      value={formData.referral_khusus_id || bpjsReferral?.khusus_id_rujukan || ""}
                      onChange={(e) => onFormChange("referral_khusus_id", e.target.value)}
                      disabled={isDisabled}
                      placeholder="Terisi setelah create jika tersedia"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={createRujukanKhusus} disabled={isDisabled || bpjsSubmitting}>
                    {bpjsSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Buat Rujukan Khusus
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={deleteRujukanKhusus}
                    disabled={isDisabled || bpjsSubmitting || !formData.referral_khusus_id || !formData.referral_no_rujukan}
                  >
                    Hapus Rujukan Khusus
                  </Button>
                </div>
              </div>
            )}

            {(referralMode !== "manual") && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Ringkasan Klinis Rujukan</Label>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Ringkasan Klinis</Label>
                  <Textarea
                    placeholder="Diagnosis dan ringkasan kondisi klinis pasien..."
                    value={formData.referral_diagnosis}
                    onChange={(e) => onFormChange("referral_diagnosis", e.target.value)}
                    className="min-h-[80px] resize-none"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Terapi yang Sudah Diberikan</Label>
                  <Textarea
                    placeholder="Terapi dan tindakan yang sudah dilakukan..."
                    value={formData.referral_therapy}
                    onChange={(e) => onFormChange("referral_therapy", e.target.value)}
                    className="min-h-[60px] resize-none"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Hasil Pemeriksaan Penunjang</Label>
                  <Textarea
                    placeholder="Hasil lab, radiologi, atau pemeriksaan penunjang lainnya..."
                    value={formData.referral_lab_result}
                    onChange={(e) => onFormChange("referral_lab_result", e.target.value)}
                    className="min-h-[60px] resize-none"
                    disabled={isDisabled}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving || isDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan Rujukan
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <SearchModal
      open={diagnosaModalOpen}
      onOpenChange={setDiagnosaModalOpen}
      title="Cari Diagnosa Rujukan (SIMRS ICD-10)"
      placeholder="Ketik kode atau nama diagnosa..."
      columns={[
        { key: "kode", label: "Kode", width: "120px" },
        { key: "nama", label: "Nama Diagnosa" },
      ]}
      onSearch={searchReferralDiagnosa}
      onSelect={(item) => {
        setSelectedDiagnosaNama(item.nama || "");
        onFormChange("referral_diag_code", item.kode || "");
        onFormChange("referral_diagnosis", item.kode && item.nama ? `${item.kode} - ${item.nama}` : (item.kode || ""));
      }}
    />

    <SearchModal
      open={poliModalOpen}
      onOpenChange={setPoliModalOpen}
      title="Cari Kode Poli Rujukan (List Spesialistik BPJS)"
      placeholder="Ketik kode/nama spesialistik (opsional)..."
      columns={[
        { key: "kode", label: "Kode", width: "120px" },
        { key: "nama", label: "Nama Spesialistik" },
        { key: "kapasitas", label: "Kapasitas", width: "120px" },
        { key: "jumlah_rujukan", label: "Jml Rujukan", width: "140px" },
        { key: "persentase", label: "Persentase", width: "120px" },
      ]}
      minSearchLength={0}
      onSearch={searchReferralPoliSpesialistik}
      onSelect={(item) => {
        setSelectedPoliNama(item.nama || "");
        onFormChange("referral_poli_code", item.kode || "");
        onFormChange("referral_specialist", item.nama || "");
      }}
    />

    <Dialog open={ppkDialogOpen} onOpenChange={setPpkDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah PPK Baru</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2">
          <div className="space-y-2">
            <Label>Kode BPJS</Label>
            <Input value={ppkForm.kode_bpjs} onChange={(e) => setPpkForm((prev) => ({ ...prev, kode_bpjs: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Nama PPK</Label>
            <Input value={ppkForm.nama} onChange={(e) => setPpkForm((prev) => ({ ...prev, nama: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Alamat</Label>
            <Input value={ppkForm.alamat} onChange={(e) => setPpkForm((prev) => ({ ...prev, alamat: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Telepon</Label>
            <Input value={ppkForm.telepon} onChange={(e) => setPpkForm((prev) => ({ ...prev, telepon: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPpkDialogOpen(false)} disabled={ppkSaving}>Batal</Button>
          <Button onClick={savePPK} disabled={ppkSaving}>
            {ppkSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Simpan PPK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// Props for death drawer (meninggal)
interface DeathDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: DispositionFormData;
  onFormChange: (field: string, value: string | number | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
  isDisabled: boolean;
}

export function DeathDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
}: DeathDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <div>
              <SheetTitle>Meninggal</SheetTitle>
              <SheetDescription>Pasien meninggal dunia</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            <Alert className="border-muted-foreground/20 bg-muted/30">
              <AlertDescription className="text-sm text-muted-foreground">
                Untuk detail lengkap surat kematian (penyebab ICD-10, saksi, dll), silakan buka tab <strong>"Surat Kematian"</strong> di menu sebelah kiri.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Waktu Kematian</Label>
                <Input
                  type="datetime-local"
                  value={formData.death_time}
                  onChange={(e) => onFormChange("death_time", e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm">Penyebab Kematian</Label>
                <Textarea
                  placeholder="Penyebab kematian pasien..."
                  value={formData.death_cause}
                  onChange={(e) => onFormChange("death_cause", e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isDisabled}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving || isDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// OUTPATIENT TRANSFER DRAWER (UGD → Rawat Jalan)
// ============================================================

interface OutpatientTransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: DispositionFormData;
  onFormChange: (field: string, value: string | number | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
  isDisabled: boolean;
  poliRooms: Room[];
  availableDoctors: AvailableDoctor[];
  loadingDoctors: boolean;
}

export function OutpatientTransferDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
  poliRooms,
  availableDoctors,
  loadingDoctors,
}: OutpatientTransferDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Hospital className="h-5 w-5 text-blue-600" />
            <div>
              <SheetTitle>Rujuk ke Rawat Jalan</SheetTitle>
              <SheetDescription>Pasien tidak gawat darurat, dirujuk ke poli rawat jalan</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <Send className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Pasien akan dipindahkan dari UGD ke poli rawat jalan. 
                Pendaftaran dan billing tetap satu dengan <strong>biaya pendaftaran UGD</strong> dan <strong>biaya pendaftaran rawat jalan</strong>.
              </AlertDescription>
            </Alert>

            {/* Poli Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Poli Tujuan <span className="text-destructive">*</span>
              </Label>
              <Combobox
                options={poliRooms.map(r => ({ value: r.id.toString(), label: r.name }))}
                value={(formData as any).outpatient_room_id?.toString() || ""}
                onValueChange={(value) => {
                  onFormChange("outpatient_room_id", value ? parseInt(value) : undefined);
                  onFormChange("outpatient_doctor_id", undefined);
                }}
                placeholder="Pilih poli rawat jalan..."
                searchPlaceholder="Cari poli..."
                emptyText="Poli tidak ditemukan"
                disabled={isDisabled}
              />
            </div>

            {/* Doctor Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Dokter <span className="text-destructive">*</span>
              </Label>
              {loadingDoctors ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memuat jadwal dokter...</span>
                </div>
              ) : availableDoctors.length === 0 && (formData as any).outpatient_room_id ? (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    Tidak ada dokter yang praktik saat ini di poli yang dipilih.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableDoctors.map((doctor) => (
                    <button
                      key={doctor.employee_id}
                      type="button"
                      onClick={() => onFormChange("outpatient_doctor_id", doctor.employee_id)}
                      disabled={isDisabled}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        (formData as any).outpatient_doctor_id === doctor.employee_id
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-muted hover:border-primary/50 hover:bg-muted/30"
                      )}
                    >
                      <div className="font-medium text-sm">{doctor.employee_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Jam praktik: {doctor.start_time} - {doctor.end_time}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Transfer Reason */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Alasan Rujuk</Label>
              <Textarea
                placeholder="Alasan pasien dirujuk ke rawat jalan..."
                value={(formData as any).transfer_reason || ""}
                onChange={(e) => onFormChange("transfer_reason", e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isDisabled}
              />
            </div>

            {/* Disposition Note */}
            <div className="space-y-2">
              <Label className="text-sm">Catatan Tambahan</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={formData.disposition_note}
                onChange={(e) => onFormChange("disposition_note", e.target.value)}
                className="min-h-[60px] resize-none"
                disabled={isDisabled}
              />
            </div>

            {/* Summary */}
            {(formData as any).outpatient_room_id && (formData as any).outpatient_doctor_id && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700">Konfirmasi Transfer</AlertTitle>
                <AlertDescription className="text-green-600">
                  Pasien akan dipindahkan ke{' '}
                  <strong>{poliRooms.find(r => r.id === (formData as any).outpatient_room_id)?.name}</strong>
                  {' '}dengan dokter{' '}
                  <strong>{availableDoctors.find(d => d.employee_id === (formData as any).outpatient_doctor_id)?.employee_name}</strong>.
                  <br />
                  <span className="text-xs mt-1 block">Antrian rawat jalan akan dibuat otomatis.</span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button 
              onClick={onSubmit} 
              disabled={saving || isDisabled || !(formData as any).outpatient_room_id || !(formData as any).outpatient_doctor_id}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Transfer ke Rawat Jalan
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

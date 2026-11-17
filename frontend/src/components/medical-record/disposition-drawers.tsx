import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  SheetFooter,
  SheetHeader,
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
  ExternalLink,
  Send,
  Search,
  type LucideIcon,
  Plus,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { SearchModal } from "@/components/sep/search-modal";
import {
  BPJS_FIELD_CLASS,
  BPJS_PANEL_CLASS,
  BPJSSectionHeader,
  BPJSStatePanel,
} from "@/components/sep/bpjs-sheet-chrome";
import { cn } from "@/lib/utils";
import { CheckInQRCode } from "@/components/qrcode/checkin-qrcode";
import { BPJSControlSection } from "@/components/medical-record/bpjs-control-section";
import { BedSelectionModal } from "@/components/medical-record/bed-selection-modal";
import { useToast } from "@/hooks/use-toast";
import { icd10Api } from "@/lib/api/icd";
import { medicalRecordsApi, type DeathCertificate } from "@/lib/api/medical-records";
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
  referral_faskes?: string;
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
  suggested_bed_id?: number;
  suggested_bed_name?: string;
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

const DISPOSITION_BODY_CLASS = "mx-auto flex w-full max-w-[1320px] flex-col gap-5 [&_input]:rounded-none [&_input]:border-border/70 [&_input]:bg-background [&_textarea]:rounded-none [&_textarea]:border-border/70 [&_textarea]:bg-background [&_[role=combobox]]:h-10 [&_[role=combobox]]:rounded-none [&_[role=combobox]]:border-border/70 [&_[role=combobox]]:bg-background [&_[role=combobox]]:shadow-none";
const DISPOSITION_TEXTAREA_CLASS = "min-h-[96px] resize-y";
const DISPOSITION_HELP_CLASS = "text-xs leading-relaxed text-muted-foreground";


interface DispositionSheetShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: LucideIcon;
  metaLabel: string;
  railTitle: string;
  railDescription: ReactNode;
  railPoints: string[];
  railStatus?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  patientData?: {
    nama_lengkap: string;
    no_rm: string;
  } | null;
  headerAction?: ReactNode;
  bodyClassName?: string;
}

function DispositionSheetShell({
  open,
  onOpenChange,
  title,
  metaLabel,
  footer,
  children,
  patientData,
  headerAction,
  bodyClassName,
}: DispositionSheetShellProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[80vw] max-w-[80vw] flex-col gap-0 p-0 sm:w-[80vw] sm:max-w-[80vw]">
        <div className="flex flex-col border-b px-4 py-2">
          <SheetHeader className="flex flex-row items-center justify-between pr-8 space-y-0">
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold leading-tight">{title}</h4>
                <Badge variant="outline" className="text-[10px] h-5">{metaLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {patientData ? `${patientData.nama_lengkap} • RM ${patientData.no_rm}` : "Data Pasien Tidak Tersedia"}
              </p>
            </div>
            {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pt-2 pb-4">
            <div className={bodyClassName ?? DISPOSITION_BODY_CLASS}>{children}</div>
          </div>
        </ScrollArea>

        <SheetFooter className="px-4 py-3 border-t sm:justify-end gap-2">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface DispositionSectionProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function DispositionSection({ eyebrow, title, description, action, children, className }: DispositionSectionProps) {
  return (
    <div className={cn(BPJS_PANEL_CLASS, "p-4 sm:p-5", className)}>
      <BPJSSectionHeader eyebrow={eyebrow} title={title} action={action} />
      {description ? <div className={DISPOSITION_HELP_CLASS}>{description}</div> : null}
      {children}
    </div>
  );
}

type SelectionCardTone = "neutral" | "blue" | "green" | "amber" | "rose";

interface SelectionCardOption {
  value: string;
  title: string;
  description: string;
  icon?: ReactNode;
  tone?: SelectionCardTone;
  disabled?: boolean;
  note?: ReactNode;
}

interface SelectionCardGridProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectionCardOption[];
  columns?: 2 | 3 | 4;
  disabled?: boolean;
}

function SelectionCardGrid({ value, onChange, options, columns = 3, disabled = false }: SelectionCardGridProps) {
  const gridClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }[columns];

  const toneClass: Record<SelectionCardTone, { selected: string; icon: string }> = {
    neutral: { selected: "border-slate-400 bg-slate-50/80", icon: "text-slate-600" },
    blue: { selected: "border-sky-400 bg-sky-50/80", icon: "text-sky-600" },
    green: { selected: "border-emerald-400 bg-emerald-50/80", icon: "text-emerald-600" },
    amber: { selected: "border-amber-400 bg-amber-50/80", icon: "text-amber-600" },
    rose: { selected: "border-rose-400 bg-rose-50/80", icon: "text-rose-600" },
  };

  return (
    <div className={cn("grid gap-3", gridClass)}>
      {options.map((option) => {
        const tone = toneClass[option.tone || "neutral"];
        const isSelected = value === option.value;
        const isUnavailable = disabled || option.disabled;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            disabled={isUnavailable}
            className={cn(
              BPJS_PANEL_CLASS,
              "min-h-[124px] p-4 text-left transition-colors",
              isSelected ? tone.selected : "hover:border-foreground/30 hover:bg-muted/10",
              isUnavailable && "cursor-not-allowed opacity-55 hover:border-border/70 hover:bg-background",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {option.icon ? <span className={cn("shrink-0", tone.icon)}>{option.icon}</span> : null}
                  <span>{option.title}</span>
                </div>
                <p className={DISPOSITION_HELP_CLASS}>{option.description}</p>
              </div>
              {isSelected ? (
                <Badge variant="outline" className="rounded-none border-border/70 text-[10px] uppercase tracking-[0.18em]">
                  Dipilih
                </Badge>
              ) : null}
            </div>
            {option.note ? <div className="mt-3 text-xs leading-relaxed text-muted-foreground">{option.note}</div> : null}
          </button>
        );
      })}
    </div>
  );
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
  setSuratKontrolResult: (data: SuratKontrolResponse | null) => void;
  // Options
  dischargeConditionOptions: { value: string; label: string }[];
  // Surat Kontrol Type Selection
  kontrolType: "none" | "simrs" | "bpjs";
  setKontrolType: (type: "none" | "simrs" | "bpjs") => void;
}

interface FollowUpDoctorSelectorProps {
  label: string;
  loadingDoctors: boolean;
  roomClosed: boolean;
  availableDoctors: AvailableDoctor[];
  selectedDoctorId?: number;
  hasRoomSelected: boolean;
  isDisabled: boolean;
  onSelectDoctor: (doctorId: number) => void;
  columnsClassName?: string;
}

function FollowUpDoctorSelector({
  label,
  loadingDoctors,
  roomClosed,
  availableDoctors,
  selectedDoctorId,
  hasRoomSelected,
  isDisabled,
  onSelectDoctor,
  columnsClassName = "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
}: FollowUpDoctorSelectorProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} <span className="text-destructive">*</span>
      </Label>
      {loadingDoctors ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Memuat jadwal dokter...</span>
        </div>
      ) : roomClosed ? (
        <div className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Poli tutup pada tanggal ini.
        </div>
      ) : availableDoctors.length === 0 ? (
        <div className="border-b border-dashed border-border/70 py-2.5 text-xs text-muted-foreground">
          {hasRoomSelected ? "Tidak ada dokter yang praktik." : "Pilih poli tujuan untuk melihat jadwal dokter."}
        </div>
      ) : (
        <div className={cn("grid gap-2", columnsClassName)}>
          {availableDoctors.map((doctor) => {
            const isSelected = selectedDoctorId === doctor.employee_id;
            return (
              <button
                key={doctor.employee_id}
                type="button"
                onClick={() => onSelectDoctor(doctor.employee_id)}
                disabled={isDisabled}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 bg-background hover:bg-muted/40"
                )}
              >
                <div className="text-xs font-medium leading-tight">{doctor.employee_name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {doctor.start_time} - {doctor.end_time}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

  const footer = (
    <div className="flex w-full justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
        Batal
      </Button>
      <Button size="sm" onClick={onSubmit} disabled={saving || isDisabled} className="h-8 text-xs">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
        Simpan & Pulangkan
      </Button>
    </div>
  );

  return (
    <DispositionSheetShell
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Pasien Pulang"
      title={formData.disposition_type === "pulang" ? "Pemulangan Pasien" : "Atas Permintaan Sendiri"}
      description={
        formData.disposition_type === "pulang"
          ? "Ringkas pemulangan, kontrol lanjutan, dan instruksi pasien dalam satu alur yang aman."
          : "Dokumentasikan pasien pulang atas permintaan sendiri dengan kondisi keluar yang jelas."
      }
      icon={formData.disposition_type === "pulang" ? Home : ExternalLink}
      metaLabel={formData.disposition_type === "pulang" ? "DISCHARGE" : "APS"}
      railTitle={formData.disposition_type === "pulang" ? "Checklist Pemulangan" : "Checklist APS"}
      railDescription=""
      railPoints={[]}
      footer={footer}
      patientData={patientData}
      bodyClassName="mx-auto flex w-full max-w-[1320px] flex-col divide-y divide-border/70"
      headerAction={
        !isAPS && (
          <div className="flex flex-col items-end gap-1">
            <div className="inline-flex items-center rounded-md border border-border/60 bg-muted p-0.5">
              {(
                [
                  { value: "none", label: "Tanpa Kontrol" },
                  { value: "simrs", label: "Kontrol SIMRS" },
                  { value: "bpjs", label: "Kontrol BPJS" },
                ] as const
              ).map((opt) => {
                const active = kontrolType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKontrolType(opt.value)}
                    disabled={isDisabled}
                    className={cn(
                      "h-7 rounded-sm px-2.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      isDisabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {!patientNoBpjs && kontrolType === "none" && (
              <span className="text-[10px] font-medium text-amber-600 leading-none">
                * Pasien tidak memiliki No. BPJS
              </span>
            )}
          </div>
        )
      }
    >
      {/* BPJS Control Section & SIMRS Sync */}
      {showBPJSKontrol && (
        <div className="py-4 first:pt-1 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Kontrol BPJS &amp; Sinkronisasi
          </div>

          {patientNoBpjs && activeSEP && patientData ? (
            <div className="space-y-4">
              <BPJSControlSection
                dispositionType={formData.disposition_type as "pulang" | "aps"}
                activeSEP={activeSEP}
                patient={patientData}
                visitId={visitId}
                isDisabled={isDisabled}
                existingSuratKontrol={suratKontrolResult}
                onSuratKontrolCreated={(skData) => setSuratKontrolResult(skData)}
                onSuratKontrolCleared={() => setSuratKontrolResult(null)}
                className="space-y-3"
              />

              {/* SIMRS Follow Up Form - shown after BPJS Surat Kontrol is created */}
              {showBPJSFollowUpSync && (
                <div className="border-t border-border/60 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      <span>Sinkronisasi SIMRS</span>
                    </div>
                    <Badge variant="outline" className="h-5 text-[10px] border-blue-300 text-blue-700">
                      Wajib
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Tgl Kontrol (BPJS)
                      </Label>
                      <Input
                        type="date"
                        value={suratKontrolResult?.tglRencanaKontrol || formData.follow_up_date}
                        className="h-8 text-xs bg-muted rounded-md"
                        disabled
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="follow_up_room_id_bpjs_sync" className="text-xs font-medium">
                        Poli Tujuan <span className="text-destructive">*</span>
                      </Label>
                      <Combobox
                        options={poliRooms.map(r => ({ value: r.id.toString(), label: r.name }))}
                        value={formData.follow_up_room_id?.toString() || ""}
                        onValueChange={(value) => {
                          onFormChange("follow_up_room_id", value ? parseInt(value) : undefined);
                          onFormChange("follow_up_doctor_id", undefined);
                          if (suratKontrolResult?.tglRencanaKontrol) {
                            onFormChange("follow_up_date", suratKontrolResult.tglRencanaKontrol);
                          }
                        }}
                        placeholder="Pilih poli..."
                        searchPlaceholder="Cari poli..."
                        emptyText="Poli tidak ditemukan"
                        disabled={isDisabled}
                        className="h-8 text-xs rounded-md"
                      />
                    </div>
                  </div>

                  <FollowUpDoctorSelector
                    label="Pilih Dokter SIMRS"
                    loadingDoctors={loadingDoctors}
                    roomClosed={roomClosed}
                    availableDoctors={availableDoctors}
                    selectedDoctorId={formData.follow_up_doctor_id}
                    hasRoomSelected={!!formData.follow_up_room_id}
                    isDisabled={isDisabled}
                    onSelectDoctor={(id) => onFormChange("follow_up_doctor_id", id)}
                    columnsClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold">Tidak Dapat Membuat Surat Kontrol BPJS</div>
                <p>
                  {!patientNoBpjs
                    ? 'Pasien tidak memiliki nomor BPJS. Silakan pilih "Kontrol SIMRS" atau lengkapi data BPJS.'
                    : !activeSEP
                    ? "Pasien belum memiliki SEP aktif untuk kunjungan ini."
                    : "Data pasien tidak lengkap."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow Up Form (Kontrol SIMRS) */}
      {showFollowUpFields && (
        <div className="py-3 first:pt-1 space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Kontrol SIMRS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="follow_up_date_drawer" className="text-xs font-medium">
                Tanggal Kontrol <span className="text-destructive">*</span>
              </Label>
              <Input
                id="follow_up_date_drawer"
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => onFormChange("follow_up_date", e.target.value)}
                className="h-8 text-xs bg-background rounded-md"
                min={new Date().toISOString().split("T")[0]}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="follow_up_room_id_drawer" className="text-xs font-medium">
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
                className="h-8 text-xs rounded-md"
              />
            </div>
          </div>

          <FollowUpDoctorSelector
            label="Pilih Dokter"
            loadingDoctors={loadingDoctors}
            roomClosed={roomClosed}
            availableDoctors={availableDoctors}
            selectedDoctorId={formData.follow_up_doctor_id}
            hasRoomSelected={!!formData.follow_up_room_id}
            isDisabled={isDisabled}
            onSelectDoctor={(id) => onFormChange("follow_up_doctor_id", id)}
          />

          <div className="space-y-1">
            <Label htmlFor="follow_up_instruction_drawer" className="text-xs font-medium">
              Instruksi Kontrol
            </Label>
            <Textarea
              id="follow_up_instruction_drawer"
              placeholder="Rencana pemeriksaan/tindakan saat kontrol..."
              value={formData.follow_up_instruction}
              onChange={(e) => onFormChange("follow_up_instruction", e.target.value)}
              className="min-h-[64px] resize-y text-xs rounded-md"
              disabled={isDisabled}
            />
          </div>

          {followUpRegData && (
            <div className="border-t border-border/60 pt-2.5 space-y-1">
              <Label className="text-xs font-medium">Jadwal Kontrol Terdaftar</Label>
              <div className="flex items-center gap-3 border-l-2 border-blue-500 bg-blue-50/50 px-3 py-2">
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
                <div className="text-xs space-y-0.5 text-blue-900">
                  <p className="font-semibold">{followUpRegData.registration_number}</p>
                  {followUpRegData.scheduled_date && (
                    <p>{new Date(followUpRegData.scheduled_date).toLocaleDateString("id-ID")}</p>
                  )}
                  {followUpRegData.room_name && <p className="text-muted-foreground">{followUpRegData.room_name}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discharge Condition & Instructions */}
      <div className="py-3 first:pt-1 last:pb-1 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Kondisi &amp; Edukasi Pasien
        </div>

        {showDischargeCondition && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">
              Kondisi Pasien Saat Pulang
            </Label>
            <Combobox
              options={dischargeConditionOptions}
              value={formData.discharge_condition}
              onValueChange={(value) => onFormChange("discharge_condition", value)}
              placeholder="Pilih kondisi keluar..."
              searchPlaceholder="Cari kondisi..."
              emptyText="Kondisi tidak ditemukan"
              disabled={isDisabled}
              className="h-8 text-xs rounded-md"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="discharge_instruction_drawer" className="text-xs font-medium">
              Instruksi untuk Pasien
            </Label>
            <Textarea
              id="discharge_instruction_drawer"
              placeholder="Instruksi yang harus diikuti pasien setelah pulang..."
              value={formData.discharge_instruction}
              onChange={(e) => onFormChange("discharge_instruction", e.target.value)}
              className="min-h-[72px] resize-y text-xs rounded-md"
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="discharge_medication_drawer" className="text-xs font-medium">
              Obat Pulang
            </Label>
            <Textarea
              id="discharge_medication_drawer"
              placeholder="Daftar obat yang dibawa pulang beserta aturan pakai..."
              value={formData.discharge_medication}
              onChange={(e) => onFormChange("discharge_medication", e.target.value)}
              className="min-h-[72px] resize-y text-xs rounded-md"
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>
    </DispositionSheetShell>
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
  spriType,
  setSpriType,
}: AdmissionDrawerProps) {
  const hasBPJSSPRI = !!spriResult;
  const showBPJSSPRI = spriType === "bpjs";
  const showSIMRSForm = spriType === "simrs";
  const [bedModalOpen, setBedModalOpen] = useState(false);

  const footer = (
    <div className="flex w-full justify-end gap-3">
      <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none border-border/70">
        Batal
      </Button>
      <Button onClick={onSubmit} disabled={saving || isDisabled} className="rounded-none">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {hasBPJSSPRI ? "Simpan Disposisi" : "Kirim Permintaan"}
      </Button>
    </div>
  );

  return (
    <DispositionSheetShell
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Pasien Pulang"
      title="Rencana Rawat Inap"
      description="Satukan keputusan rawat inap, dokumen BPJS, dan permintaan admisi dalam drawer yang lebih lega dan terstruktur."
      icon={Hospital}
      metaLabel="ADMISI"
      railTitle="Checklist Rawat Inap"
      railDescription="Drawer admisi dirombak menjadi workbench dua kolom: rel panduan di kiri, field tetap di kanan. Tidak ada field yang dihapus atau diganti."
      railPoints={[
        "Pilih jalur admisi terlebih dahulu: SIMRS untuk umum, SPRI untuk BPJS.",
        "Lengkapi tipe rawat inap, prioritas, dan indikasi klinis sebelum permintaan dikirim.",
        "Jika SPRI sudah dibuat, pastikan data SIMRS tetap diisi agar admisi bisa menindaklanjuti.",
      ]}
      railStatus={spriType === "bpjs" ? (
        <BPJSStatePanel
          tone={patientNoBpjs ? "success" : "danger"}
          title={patientNoBpjs ? "SPRI siap diproses" : "SPRI belum bisa diproses"}
          description={patientNoBpjs ? "Bridging BPJS dapat digunakan bila data pasien lengkap." : "Nomor BPJS pasien belum tersedia, jadi jalur SPRI dinonaktifkan."}
        />
      ) : undefined}
      footer={footer}
      patientData={patientData}
    >
      {/* Pilihan Jenis Rawat Inap */}
      <DispositionSection
        eyebrow="Mode Admisi"
        title="Pilih Jalur Permintaan Rawat Inap"
        description=""
      >
        <SelectionCardGrid
          value={spriType}
          onChange={(value) => setSpriType(value as "simrs" | "bpjs")}
          disabled={isDisabled}
          columns={2}
          options={[
            {
              value: "simrs",
              title: "Admisi SIMRS",
              description: "Permintaan rawat inap umum langsung ke pendaftaran atau admisi.",
              icon: <Hospital className="h-4 w-4" />,
              tone: "blue",
            },
            {
              value: "bpjs",
              title: "SPRI BPJS",
              description: "Bangun permintaan rawat inap dari bridging VClaim lalu sinkronkan ke SIMRS.",
              icon: <Hospital className="h-4 w-4" />,
              tone: "green",
              disabled: !patientNoBpjs,
              note: !patientNoBpjs ? "Nomor BPJS belum tersedia pada data pasien." : undefined,
            },
          ]}
        />
      </DispositionSection>

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
          {/* Admission Type Selection */}
          {/* Saran Bed Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Saran Tempat Tidur</Label>
            <div className="border-2 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm">
                {formData.suggested_bed_name ? (
                  <>
                    <span className="text-muted-foreground">Saran Bed:</span> <span className="font-semibold text-primary">{formData.suggested_bed_name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Belum ada tempat tidur yang disarankan.</span>
                )}
              </div>
              <div className="flex gap-2">
                {formData.suggested_bed_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onFormChange("suggested_bed_id", undefined);
                      onFormChange("suggested_bed_name", "");
                    }}
                    disabled={isDisabled}
                  >
                    Hapus
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setBedModalOpen(true)}
                  disabled={isDisabled}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {formData.suggested_bed_id ? "Ubah Saran Bed" : "Pilih Saran Bed"}
                </Button>
              </div>
            </div>
          </div>

          <BedSelectionModal
            open={bedModalOpen}
            onOpenChange={setBedModalOpen}
            onSelect={(bed) => {
              onFormChange("suggested_bed_id", bed.id);
              const roomName = bed.room_unit?.room?.name ? `${bed.room_unit.room.name} - ` : "";
              const unitName = bed.room_unit?.name || "";
              onFormChange("suggested_bed_name", `${roomName}${unitName} (Bed ${bed.bed_number})`);
            }}
          />

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
          {/* <div className="space-y-2">
            <Label className="text-sm">Kelas Kamar yang Diinginkan</Label>
            <Combobox
              options={inpatientClassOptions}
              value={formData.preferred_class || ""}
              onValueChange={(value) => onFormChange("preferred_class", value)}
              placeholder="Pilih kelas kamar..."
              searchPlaceholder="Cari kelas..."
              emptyText="Tidak ada kelas"
              disabled={isDisabled}
              className={BPJS_FIELD_CLASS}
            />
            <p className="text-xs text-muted-foreground">
              Opsional. Bagian admisi akan menyesuaikan dengan ketersediaan kamar.
            </p>
          </div> */}

          <div className="space-y-2">
            <Label className="text-sm">
              Alasan/Indikasi Rawat Inap <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Jelaskan alasan klinis pasien perlu dirawat inap..."
              value={formData.admission_reason}
              onChange={(e) => onFormChange("admission_reason", e.target.value)}
              className={DISPOSITION_TEXTAREA_CLASS}
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Catatan Khusus</Label>
            <Textarea
              placeholder="Catatan khusus untuk bagian admisi (misal: perlu ruang isolasi, pasien bariatrik, dll)..."
              value={formData.special_notes || ""}
              onChange={(e) => onFormChange("special_notes", e.target.value)}
              className={DISPOSITION_TEXTAREA_CLASS}
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

            {/* Saran Bed Selection */}
            <div className="space-y-2">
              <Label className="text-sm">Saran Tempat Tidur</Label>
              <div className="border-2 border-blue-200/50 bg-white/50 dark:bg-black/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm">
                  {formData.suggested_bed_name ? (
                    <>
                      <span className="text-muted-foreground">Saran Bed:</span> <span className="font-semibold text-primary">{formData.suggested_bed_name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Belum ada tempat tidur yang disarankan.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {formData.suggested_bed_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onFormChange("suggested_bed_id", undefined);
                        onFormChange("suggested_bed_name", "");
                      }}
                      disabled={isDisabled}
                    >
                      Hapus
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBedModalOpen(true)}
                    disabled={isDisabled}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {formData.suggested_bed_id ? "Ubah Saran Bed" : "Pilih Saran Bed"}
                  </Button>
                </div>
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
            {/* <div className="space-y-2">
              <Label className="text-sm">Kelas Kamar yang Diinginkan</Label>
              <Combobox
                options={inpatientClassOptions}
                value={formData.preferred_class || ""}
                onValueChange={(value) => onFormChange("preferred_class", value)}
                placeholder="Pilih kelas kamar..."
                searchPlaceholder="Cari kelas..."
                emptyText="Tidak ada kelas"
                disabled={isDisabled}
                className={BPJS_FIELD_CLASS}
              />
              <p className="text-xs text-muted-foreground">
                Opsional. Bagian admisi akan menyesuaikan dengan ketersediaan kamar.
              </p>
            </div> */}

            <div className="space-y-2">
              <Label className="text-sm">
                Alasan/Indikasi Rawat Inap <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Jelaskan alasan klinis pasien perlu dirawat inap..."
                value={formData.admission_reason}
                onChange={(e) => onFormChange("admission_reason", e.target.value)}
                className={DISPOSITION_TEXTAREA_CLASS}
                disabled={isDisabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Catatan Khusus</Label>
              <Textarea
                placeholder="Catatan khusus untuk bagian admisi (misal: perlu ruang isolasi, pasien bariatrik, dll)..."
                value={formData.special_notes || ""}
                onChange={(e) => onFormChange("special_notes", e.target.value)}
                className={DISPOSITION_TEXTAREA_CLASS}
                disabled={isDisabled}
              />
            </div>
          </div>
        </>
      )}
    </DispositionSheetShell>
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
  const [bpjsSubmitting, setBpjsSubmitting] = useState(false);
  const [bpjsReferral, setBpjsReferral] = useState<VClaimReferralLocal | null>(null);
  const [ppkDialogOpen, setPpkDialogOpen] = useState(false);
  const [ppkSaving, setPpkSaving] = useState(false);
  const [diagnosaModalOpen, setDiagnosaModalOpen] = useState(false);
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [ppkSearchModalOpen, setPpkSearchModalOpen] = useState(false);
  const [selectedDiagnosaNama, setSelectedDiagnosaNama] = useState("");
  const [selectedPoliNama, setSelectedPoliNama] = useState("");
  const [ppkForm, setPpkForm] = useState({ kode_bpjs: "", nama: "", alamat: "", telepon: "" });

  const selectedPPKName = useMemo(() => {
    return ppkOptions.find((p) => p.value === (formData.referral_ppk_code || ""))?.label || "";
  }, [ppkOptions, formData.referral_ppk_code]);

  const loadPPK = async () => {
    try {
      const res = await ppkApi.getAll({ active: true, limit: 1000 });
      const items = res.data.data || [];
      setPpkOptions(items.map((item) => ({ value: item.kode_bpjs, label: item.nama })));
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat master PPK." });
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
    if (!formData.referral_faskes) {
      onFormChange("referral_faskes", "2");
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

  const footer = (
    <div className="flex w-full justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
        Batal
      </Button>
      <Button size="sm" onClick={onSubmit} disabled={saving || isDisabled} className="h-8 text-xs">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
        Simpan Rujukan
      </Button>
    </div>
  );

  return (
    <>
      <DispositionSheetShell
        open={open}
        onOpenChange={onOpenChange}
        eyebrow="Pasien Pulang"
        title="Rujukan Pasien"
        description="Pisahkan jalur rujukan manual, BPJS reguler, dan BPJS khusus dengan pilihan yang lebih jelas sebelum data klinis diisi."
        icon={Ambulance}
        metaLabel="RUJUK"
        railTitle="Checklist Rujukan"
        railDescription=""
        railPoints={[]}
        footer={footer}
        patientData={patientData}
        bodyClassName="mx-auto flex w-full max-w-[1320px] flex-col divide-y divide-border/70"
        headerAction={
          <div className="inline-flex items-center rounded-md border border-border/60 bg-muted p-0.5">
            {(
              [
                { value: "manual", label: "Manual SIMRS" },
                { value: "bpjs_v1", label: "BPJS V1" },
                { value: "bpjs_v2", label: "BPJS V2" },
                { value: "bpjs_khusus", label: "BPJS Khusus" },
              ] as const
            ).map((opt) => {
              const active = referralMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFormChange("referral_mode", opt.value)}
                  disabled={isDisabled}
                  className={cn(
                    "h-7 rounded-sm px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    isDisabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        }
      >
        {referralMode === "manual" && (
          <>
            <div className="py-3 first:pt-1 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rujukan SIMRS
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Fasilitas Tujuan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nama fasilitas kesehatan tujuan"
                    value={formData.referral_facility}
                    onChange={(e) => onFormChange("referral_facility", e.target.value)}
                    disabled={isDisabled}
                    className="h-8 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Spesialis Tujuan</Label>
                  <Input
                    placeholder="Contoh: Sp.PD, Sp.JP, Sp.B, dll"
                    value={formData.referral_specialist}
                    onChange={(e) => onFormChange("referral_specialist", e.target.value)}
                    disabled={isDisabled}
                    className="h-8 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Urgensi Rujukan</Label>
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
                    className="h-8 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-medium">Alamat Fasilitas</Label>
                  <Input
                    placeholder="Alamat lengkap fasilitas tujuan"
                    value={formData.referral_address}
                    onChange={(e) => onFormChange("referral_address", e.target.value)}
                    disabled={isDisabled}
                    className="h-8 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Telepon Fasilitas</Label>
                  <Input
                    placeholder="Nomor telepon fasilitas"
                    value={formData.referral_phone}
                    onChange={(e) => onFormChange("referral_phone", e.target.value)}
                    disabled={isDisabled}
                    className="h-8 text-xs rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="py-3 last:pb-1 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ringkasan Klinis
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Alasan Rujukan <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Alasan pasien dirujuk ke fasilitas lain..."
                    value={formData.referral_reason}
                    onChange={(e) => onFormChange("referral_reason", e.target.value)}
                    className="min-h-[68px] resize-y text-xs rounded-md"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Diagnosis / Ringkasan Klinis</Label>
                  <Textarea
                    placeholder="Diagnosis dan ringkasan kondisi klinis pasien..."
                    value={formData.referral_diagnosis}
                    onChange={(e) => onFormChange("referral_diagnosis", e.target.value)}
                    className="min-h-[68px] resize-y text-xs rounded-md"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Terapi yang Sudah Diberikan</Label>
                  <Textarea
                    placeholder="Terapi dan tindakan yang sudah dilakukan..."
                    value={formData.referral_therapy}
                    onChange={(e) => onFormChange("referral_therapy", e.target.value)}
                    className="min-h-[68px] resize-y text-xs rounded-md"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Hasil Pemeriksaan Penunjang</Label>
                  <Textarea
                    placeholder="Hasil lab, radiologi, atau pemeriksaan penunjang lainnya..."
                    value={formData.referral_lab_result}
                    onChange={(e) => onFormChange("referral_lab_result", e.target.value)}
                    className="min-h-[68px] resize-y text-xs rounded-md"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-medium">Catatan Tambahan untuk RS Tujuan</Label>
                  <Textarea
                    placeholder="Catatan tambahan yang perlu diketahui RS tujuan..."
                    value={formData.referral_notes}
                    onChange={(e) => onFormChange("referral_notes", e.target.value)}
                    className="min-h-[60px] resize-y text-xs rounded-md"
                    disabled={isDisabled}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {(referralMode === "bpjs_v1" || referralMode === "bpjs_v2") && (
          <div className="py-3 first:pt-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rujukan BPJS {referralMode === "bpjs_v1" ? "V1" : "V2"}
              </div>
              <Badge variant="outline" className="h-5 text-[10px]">
                {referralMode === "bpjs_v1" ? "V1" : "V2"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nomor SEP</Label>
                <Input
                  value={formData.referral_no_sep || activeSEP?.no_sep || ""}
                  onChange={(e) => onFormChange("referral_no_sep", e.target.value)}
                  disabled={isDisabled}
                  placeholder="Nomor SEP"
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nomor Rujukan</Label>
                <Input
                  value={formData.referral_no_rujukan || ""}
                  onChange={(e) => onFormChange("referral_no_rujukan", e.target.value)}
                  disabled={isDisabled}
                  placeholder="Terisi setelah create"
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className={cn("space-y-1", referralMode !== "bpjs_v2" && "md:col-span-2")}>
                <Label className="text-xs font-medium">Tanggal Rujukan</Label>
                <Input
                  type="date"
                  value={formData.referral_tgl_rujukan || ""}
                  onChange={(e) => onFormChange("referral_tgl_rujukan", e.target.value)}
                  disabled={isDisabled}
                  className="h-8 text-xs rounded-md"
                />
              </div>
              {referralMode === "bpjs_v2" && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Tgl Rencana Kunjungan</Label>
                  <Input
                    type="date"
                    value={formData.referral_tgl_rencana_kunjungan || ""}
                    onChange={(e) => onFormChange("referral_tgl_rencana_kunjungan", e.target.value)}
                    disabled={isDisabled}
                    className="h-8 text-xs rounded-md"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tingkat Faskes Tujuan</Label>
                <Combobox
                  options={[
                    { value: "1", label: "Faskes Tingkat 1 (Puskesmas/Klinik)" },
                    { value: "2", label: "Faskes Tingkat 2 (Rumah Sakit)" },
                  ]}
                  value={formData.referral_faskes || "2"}
                  onValueChange={(value) => {
                    onFormChange("referral_faskes", value);
                    onFormChange("referral_ppk_code", "");
                    onFormChange("referral_facility", "");
                  }}
                  placeholder="Pilih tingkat faskes"
                  disabled={isDisabled}
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">PPK Dirujuk</Label>
                  {!isDisabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[11px]"
                      onClick={() => setPpkDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      PPK Baru
                    </Button>
                  )}
                </div>
                <div className="relative w-full">
                  <Input
                    value={
                      formData.referral_facility
                        ? `${formData.referral_ppk_code || ""} - ${formData.referral_facility}`
                        : formData.referral_ppk_code || ""
                    }
                    readOnly
                    disabled={isDisabled}
                    placeholder={`Pilih dari master BPJS (Faskes ${formData.referral_faskes || "2"})`}
                    className={cn("h-8 pr-8 text-xs rounded-md cursor-pointer", isDisabled ? "bg-muted" : "bg-background")}
                    onClick={() => {
                      if (!isDisabled) setPpkSearchModalOpen(true);
                    }}
                  />
                  <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Jenis Pelayanan</Label>
                <Combobox
                  options={[{ value: "1", label: "Rawat Inap" }, { value: "2", label: "Rawat Jalan" }]}
                  value={formData.referral_jns_pelayanan || "2"}
                  onValueChange={(value) => onFormChange("referral_jns_pelayanan", value)}
                  placeholder="Pilih jenis pelayanan"
                  searchPlaceholder="Cari..."
                  emptyText="Tidak ada opsi"
                  disabled={isDisabled}
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tipe Rujukan</Label>
                <Combobox
                  options={[{ value: "0", label: "Penuh" }, { value: "1", label: "Partial" }, { value: "2", label: "Rujuk Balik" }]}
                  value={formData.referral_tipe_rujukan || "0"}
                  onValueChange={(value) => onFormChange("referral_tipe_rujukan", value)}
                  placeholder="Pilih tipe"
                  searchPlaceholder="Cari..."
                  emptyText="Tidak ada opsi"
                  disabled={isDisabled}
                  className="h-8 text-xs rounded-md"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Kode Diagnosa Rujukan</Label>
                <div className="relative w-full">
                  <Input
                    value={
                      selectedDiagnosaNama
                        ? `${formData.referral_diag_code || ""} - ${selectedDiagnosaNama}`
                        : formData.referral_diag_code || ""
                    }
                    readOnly
                    disabled={isDisabled}
                    placeholder="Pilih kode diagnosa dari master SIMRS"
                    className={cn("h-8 pr-8 text-xs rounded-md cursor-pointer", isDisabled ? "bg-muted" : "bg-background")}
                    onClick={() => {
                      if (!isDisabled) setDiagnosaModalOpen(true);
                    }}
                  />
                  <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kode Poli Rujukan</Label>
                <div className="relative w-full">
                  <Input
                    value={
                      selectedPoliNama
                        ? `${formData.referral_poli_code || ""} - ${selectedPoliNama}`
                        : formData.referral_poli_code || ""
                    }
                    readOnly
                    disabled={isDisabled || formData.referral_tipe_rujukan === "2"}
                    placeholder={formData.referral_tipe_rujukan === "2" ? "Kosong untuk tipe 2" : "Pilih dari list spesialistik BPJS"}
                    className={cn(
                      "h-8 pr-8 text-xs rounded-md cursor-pointer",
                      isDisabled || formData.referral_tipe_rujukan === "2" ? "bg-muted" : "bg-background"
                    )}
                    onClick={() => {
                      if (!(isDisabled || formData.referral_tipe_rujukan === "2")) setPoliModalOpen(true);
                    }}
                  />
                  <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-medium">Catatan Rujukan</Label>
                <Textarea
                  value={formData.referral_reason}
                  onChange={(e) => onFormChange("referral_reason", e.target.value)}
                  className="min-h-[60px] resize-y text-xs rounded-md"
                  placeholder="Catatan klinis rujukan"
                  disabled={isDisabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={deleteReferral}
                disabled={isDisabled || bpjsSubmitting || !formData.referral_no_rujukan}
              >
                Hapus Rujukan BPJS
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={createOrUpdateBPJSReferral}
                disabled={isDisabled || bpjsSubmitting}
              >
                {bpjsSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                {formData.referral_no_rujukan ? "Update Rujukan BPJS" : "Buat Rujukan BPJS"}
              </Button>
            </div>
          </div>
        )}

        {referralMode === "bpjs_khusus" && (
          <div className="py-3 first:pt-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rujukan Khusus BPJS
              </div>
              <Badge variant="outline" className="h-5 text-[10px]">Khusus</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nomor Rujukan Dasar</Label>
                <Input
                  value={formData.referral_no_rujukan || ""}
                  onChange={(e) => onFormChange("referral_no_rujukan", e.target.value)}
                  disabled={isDisabled}
                  placeholder="No rujukan dari V1/V2"
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kode Diagnosis Khusus</Label>
                <Input
                  value={formData.referral_khusus_diagnosa_codes || ""}
                  onChange={(e) => onFormChange("referral_khusus_diagnosa_codes", e.target.value)}
                  disabled={isDisabled}
                  placeholder="Pisahkan dengan koma, contoh: primer;Z49.1,sekunder;I10"
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kode Prosedur Khusus</Label>
                <Input
                  value={formData.referral_khusus_procedure_codes || ""}
                  onChange={(e) => onFormChange("referral_khusus_procedure_codes", e.target.value)}
                  disabled={isDisabled}
                  placeholder="Pisahkan dengan koma, contoh: 95.04,89.12"
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">ID Rujukan Khusus</Label>
                <Input
                  value={formData.referral_khusus_id || bpjsReferral?.khusus_id_rujukan || ""}
                  onChange={(e) => onFormChange("referral_khusus_id", e.target.value)}
                  disabled={isDisabled}
                  placeholder="Terisi setelah create jika tersedia"
                  className="h-8 text-xs rounded-md"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={deleteRujukanKhusus}
                disabled={isDisabled || bpjsSubmitting || !formData.referral_khusus_id || !formData.referral_no_rujukan}
              >
                Hapus Rujukan Khusus
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={createRujukanKhusus}
                disabled={isDisabled || bpjsSubmitting}
              >
                {bpjsSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Buat Rujukan Khusus
              </Button>
            </div>
          </div>
        )}

        {referralMode !== "manual" && (
          <div className="py-3 last:pb-1 space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ringkasan Klinis Rujukan
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-medium">Ringkasan Klinis</Label>
                <Textarea
                  placeholder="Diagnosis dan ringkasan kondisi klinis pasien..."
                  value={formData.referral_diagnosis}
                  onChange={(e) => onFormChange("referral_diagnosis", e.target.value)}
                  className="min-h-[68px] resize-y text-xs rounded-md"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Terapi yang Sudah Diberikan</Label>
                <Textarea
                  placeholder="Terapi dan tindakan yang sudah dilakukan..."
                  value={formData.referral_therapy}
                  onChange={(e) => onFormChange("referral_therapy", e.target.value)}
                  className="min-h-[68px] resize-y text-xs rounded-md"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Hasil Pemeriksaan Penunjang</Label>
                <Textarea
                  placeholder="Hasil lab, radiologi, atau pemeriksaan penunjang lainnya..."
                  value={formData.referral_lab_result}
                  onChange={(e) => onFormChange("referral_lab_result", e.target.value)}
                  className="min-h-[68px] resize-y text-xs rounded-md"
                  disabled={isDisabled}
                />
              </div>
            </div>
          </div>
        )}
      </DispositionSheetShell>

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

      <SearchModal
        open={ppkSearchModalOpen}
        onOpenChange={setPpkSearchModalOpen}
        title="Cari Fasilitas Kesehatan (PPK BPJS)"
        placeholder="Ketik kode atau nama faskes..."
        columns={[
          { key: "kode", label: "Kode", width: "120px" },
          { key: "nama", label: "Nama Faskes" },
        ]}
        onSearch={async (keyword) => {
          try {
            const res = await vclaimApi.searchFaskes(keyword, formData.referral_faskes || "2");
            return res.data.data || [];
          } catch (e) {
            return [];
          }
        }}
        onSelect={(item) => {
          onFormChange("referral_ppk_code", item.kode || "");
          onFormChange("referral_facility", item.nama || "");
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
  visitId?: number;
  patientData?: {
    nama_lengkap: string;
    no_rm: string;
  } | null;
  onNavigateToDeathCertificate?: () => void;
}

function formatDeathDateTimeLocal(raw?: string): string {
  if (!raw) return "";
  // Already YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw.slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function buildDeathCauseFromCert(cert: DeathCertificate): string {
  const parts: string[] = [];
  if (cert.primary_cause_name) {
    parts.push(cert.primary_cause_code ? `${cert.primary_cause_name} (${cert.primary_cause_code})` : cert.primary_cause_name);
  } else if (cert.primary_cause_code) {
    parts.push(cert.primary_cause_code);
  }
  if (cert.underlying_cause_name) {
    parts.push(`Penyebab dasar: ${cert.underlying_cause_name}${cert.underlying_cause_code ? ` (${cert.underlying_cause_code})` : ""}`);
  }
  if (parts.length === 0 && cert.notes) {
    parts.push(cert.notes);
  }
  return parts.join(" — ");
}

export function DeathDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  saving,
  isDisabled,
  visitId,
  patientData,
  onNavigateToDeathCertificate,
}: DeathDrawerProps) {
  const [loadingCert, setLoadingCert] = useState(false);
  const [deathCert, setDeathCert] = useState<DeathCertificate | null>(null);

  useEffect(() => {
    if (!open || !visitId) {
      return;
    }
    let cancelled = false;
    setLoadingCert(true);
    medicalRecordsApi
      .getDeathCertificates(visitId)
      .then((res) => {
        if (cancelled) return;
        const certs = res.data || [];
        if (certs.length > 0) {
          const latest = certs[0];
          setDeathCert(latest);
          const formattedTime = formatDeathDateTimeLocal(latest.death_datetime);
          if (formattedTime) {
            onFormChange("death_time", formattedTime);
          }
          const causeText = buildDeathCauseFromCert(latest);
          if (causeText) {
            onFormChange("death_cause", causeText);
          }
        } else {
          setDeathCert(null);
        }
      })
      .catch(() => {
        if (!cancelled) setDeathCert(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCert(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, visitId]);

  const handleGoToDeathCertificate = () => {
    onOpenChange(false);
    onNavigateToDeathCertificate?.();
  };

  const missingDeathCert = Boolean(visitId) && !loadingCert && !deathCert;

  const footer = (
    <div className="flex w-full justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
        Batal
      </Button>
      {missingDeathCert && onNavigateToDeathCertificate ? (
        <Button size="sm" onClick={handleGoToDeathCertificate} className="h-8 text-xs">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Buat Surat Kematian
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={saving || isDisabled || loadingCert || missingDeathCert}
          className="h-8 text-xs"
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Simpan
        </Button>
      )}
    </div>
  );

  return (
    <DispositionSheetShell
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Pasien Pulang"
      title="Dokumentasi Kematian"
      description="Catat waktu meninggal dan sebab klinis secara ringkas sebelum dokumen lanjutan dilengkapi di surat kematian."
      icon={FileText}
      metaLabel="DEATH"
      railTitle="Checklist Kematian"
      railDescription=""
      railPoints={[]}
      footer={footer}
      patientData={patientData}
      bodyClassName="mx-auto flex w-full max-w-[1320px] flex-col divide-y divide-border/70"
    >
      {/* Status Surat Kematian */}
      <div className="py-3 first:pt-1 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Surat Keterangan Kematian
        </div>

        {loadingCert ? (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Memeriksa surat keterangan kematian...</span>
          </div>
        ) : deathCert ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-emerald-500 bg-emerald-50/40 px-3 py-2 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Surat Kematian Tersedia — Data Diisi Otomatis</span>
                {deathCert.certificate_number && (
                  <Badge variant="outline" className="h-5 font-mono text-[10px]">
                    {deathCert.certificate_number}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Waktu dan penyebab kematian telah diisi dari Surat Kematian.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const formattedTime = formatDeathDateTimeLocal(deathCert.death_datetime);
                if (formattedTime) onFormChange("death_time", formattedTime);
                const causeText = buildDeathCauseFromCert(deathCert);
                if (causeText) onFormChange("death_cause", causeText);
              }}
              disabled={isDisabled}
            >
              Terapkan Ulang
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold">Surat Keterangan Kematian Belum Dibuat</div>
                <p className="text-amber-800">
                  Silakan buat Surat Keterangan Kematian terlebih dahulu di tab <strong>Surat Kematian</strong> agar waktu dan penyebab kematian terisi otomatis.
                </p>
              </div>
            </div>
            {onNavigateToDeathCertificate && (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={handleGoToDeathCertificate}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Buat Surat Kematian
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Data Kematian Dasar */}
      <div className="py-3 last:pb-1 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Data Kematian Dasar
        </div>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Waktu Kematian</Label>
            <Input
              type="datetime-local"
              value={formData.death_time}
              onChange={(e) => onFormChange("death_time", e.target.value)}
              disabled={isDisabled || missingDeathCert}
              className="h-8 text-xs rounded-md"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Penyebab Kematian</Label>
            <Textarea
              placeholder="Penyebab kematian pasien..."
              value={formData.death_cause}
              onChange={(e) => onFormChange("death_cause", e.target.value)}
              className="min-h-[80px] resize-y text-xs rounded-md"
              disabled={isDisabled || missingDeathCert}
            />
          </div>
        </div>
      </div>
    </DispositionSheetShell>
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
  const footer = (
    <div className="flex w-full justify-end gap-3">
      <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none border-border/70">
        Batal
      </Button>
      <Button
        onClick={onSubmit}
        disabled={saving || isDisabled || !(formData as any).outpatient_room_id || !(formData as any).outpatient_doctor_id}
        className="rounded-none"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Transfer ke Rawat Jalan
      </Button>
    </div>
  );

  return (
    <DispositionSheetShell
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Pasien Pulang"
      title="Transfer ke Rawat Jalan"
      description="Alihkan pasien dari UGD ke poli rawat jalan dengan pilihan poli dan dokter yang lebih jelas untuk petugas triase dan pendaftaran."
      icon={Hospital}
      metaLabel="TRANSFER"
      railTitle="Checklist Transfer"
      railDescription="Drawer transfer kini memakai rel panduan di kiri agar petugas tetap melihat konteks billing dan antrian sambil mengisi field yang sama."
      railPoints={[
        "Pilih poli tujuan lebih dulu agar daftar dokter yang muncul benar-benar relevan.",
        "Tentukan dokter tujuan sebelum catatan transfer ditulis agar ringkasan lebih akurat.",
        "Gunakan alasan rujuk dan catatan tambahan untuk menjelaskan konteks klinis perpindahan pasien.",
      ]}
      railStatus={(formData as any).outpatient_room_id && (formData as any).outpatient_doctor_id ? (
        <BPJSStatePanel
          tone="success"
          title="Transfer siap dikirim"
          description="Poli dan dokter sudah dipilih, sehingga antrian rawat jalan bisa dibuat otomatis setelah submit."
        />
      ) : undefined}
      footer={footer}
    >
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
          className={BPJS_FIELD_CLASS}
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
          className={DISPOSITION_TEXTAREA_CLASS}
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
          className={DISPOSITION_TEXTAREA_CLASS}
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
    </DispositionSheetShell>
  );
}



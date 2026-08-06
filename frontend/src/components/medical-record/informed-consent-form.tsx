import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type InformedConsent } from "@/lib/api/medical-records";
import { employeesApi, type Employee } from "@/lib/api/employees";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, Trash2, CheckCircle2, PenTool } from "lucide-react";
import { emitMedicalRecordTabSaved } from "./tab-indicator";
import { Textarea } from "@/components/ui/textarea";
import { proceduresApi, type Procedure } from "@/lib/api/procedures";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { EmployeeSignatureDialog } from "@/components/signature/employee-signature-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import SignatureCanvas from "react-signature-canvas";
import { useRef } from "react";

const HUBUNGAN_OPTIONS = [
  { value: "Suami", label: "Suami" },
  { value: "Istri", label: "Istri" },
  { value: "Anak", label: "Anak" },
  { value: "Ayah", label: "Ayah" },
  { value: "Ibu", label: "Ibu" },
  { value: "Saudara_Kandung", label: "Saudara Kandung" },
  { value: "Keluarga_Lain", label: "Keluarga Lain" },
  { value: "Diri_Sendiri", label: "Diri Sendiri" },
];

const JK_OPTIONS = [
  { value: "L", label: "Laki-laki" },
  { value: "P", label: "Perempuan" },
];

interface InformedConsentFormProps {
  visitId: number;
  consentId?: number;
  readOnly?: boolean;
  onSaved?: (newId?: number) => void;
}

function NameInputDialog({ initialName, onCancel, onConfirm }: { initialName: string, onCancel: () => void, onConfirm: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return (
    <Dialog open={true} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Data Penandatangan</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label>Nama Lengkap</Label>
          <Input
            autoFocus
            placeholder="Masukkan nama..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onConfirm(name);
              }
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Batal</Button>
          <Button onClick={() => {
            if (!name.trim()) return;
            onConfirm(name);
          }}>
            Lanjut Tanda Tangan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InformedConsentForm({ visitId, consentId, readOnly, onSaved }: InformedConsentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterProcedures, setMasterProcedures] = useState<Procedure[]>([]);
  const [selectedProcedures, setSelectedProcedures] = useState<Procedure[]>([]);
  const [procOpen, setProcOpen] = useState(false);
  const [doctors, setDoctors] = useState<Employee[]>([]);
  const [keputusanTindakanInput, setKeputusanTindakanInput] = useState("");
  const [keputusanTindakanList, setKeputusanTindakanList] = useState<string[]>([]);
  const [sigStatus, setSigStatus] = useState<DocumentSignatureStatus | null>(null);

  type SignState = { slot: string; step: 'name' | 'canvas' | 'employee'; name: string };
  const [signState, setSignState] = useState<SignState | null>(null);
  const [revokeConfirmSlot, setRevokeConfirmSlot] = useState<{ id: string; label: string } | null>(null);
  const sigPad = useRef<SignatureCanvas>(null);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (signState?.step === "canvas") {
      setTimeout(() => {
        sigPad.current?.clear();
      }, 100);
    }
  }, [signState?.step, signState?.slot]);

  // Fetch visit data to get penanggung jawab & patient
  const [visitData, setVisitData] = useState<any>(null);
  const pj = visitData?.registration;
  const patient = visitData?.registration?.patient;

  // Fetch visit data once on mount
  useEffect(() => {
    api.get(`/visits/${visitId}`).then((res: any) => {
      if (res?.data) setVisitData(res.data);
    }).catch(console.error);
  }, [visitId]);

  const form = useForm<InformedConsent>({
    defaultValues: {
      visit_id: visitId,
      judul_tindakan: "",
      jenis_tindakan: "",
      dokter_pemberi_informasi_id: null as any,
      penerima_informasi_source: "manual",
      penerima_informasi_nama: "",
      penerima_informasi_umur: 0,
      penerima_informasi_jk: "",
      penerima_informasi_alamat: "",
      penerima_informasi_hubungan: "",
      penerima_informasi_no_identitas: "",
      penerima_informasi_no_telp: "",

      info_diagnosis_kerja: false, isi_diagnosis_kerja: "",
      info_indikasi_tindakan: false, isi_indikasi_tindakan: "",
      info_tata_cara: false, isi_tata_cara: "",
      info_tujuan: false, isi_tujuan: "",
      info_risiko: false, isi_risiko: "",
      info_komplikasi: false, isi_komplikasi: "",
      info_prognosis: false, isi_prognosis: "",
      info_alternatif: false, isi_alternatif: "",
      info_lain_lain: false, isi_lain_lain: "",

      pernyataan_dokter: false,
      stmt_menerima_penjelasan: false,

      persetujuan_tindakan: "menyetujui",
      tindakan_1: "",
      tindakan_2: "",

      saksi_1_nama: "",
      saksi_2_nama: "",
      perawat_nama: "",
    },
  });

  const source = form.watch("penerima_informasi_source");

  // Auto populate if penanggung_jawab is selected
  useEffect(() => {
    if (source === "penanggung_jawab" && pj && !readOnly) {
      form.setValue("penerima_informasi_nama", pj.penanggung_jawab_nama || "");
      form.setValue("penerima_informasi_hubungan", pj.penanggung_jawab_hubungan || "");
      form.setValue("penerima_informasi_no_identitas", pj.penanggung_jawab_no_identitas || "");
      form.setValue("penerima_informasi_no_telp", pj.penanggung_jawab_no_telp || "");
      form.setValue("penerima_informasi_jk", pj.penanggung_jawab_jk || "");
    } else if (source === "diri_sendiri" && patient && !readOnly) {
      // Hitung umur dari tanggal lahir
      let umur = 0;
      if (patient.tanggal_lahir) {
        const lahir = new Date(patient.tanggal_lahir);
        const sekarang = new Date();
        umur = sekarang.getFullYear() - lahir.getFullYear();
        const m = sekarang.getMonth() - lahir.getMonth();
        if (m < 0 || (m === 0 && sekarang.getDate() < lahir.getDate())) umur--;
      }
      form.setValue("penerima_informasi_nama", patient.nama_lengkap || "");
      form.setValue("penerima_informasi_hubungan", "Diri Sendiri");
      form.setValue("penerima_informasi_no_identitas", patient.no_ktp || patient.no_rm || "");
      form.setValue("penerima_informasi_jk", patient.jenis_kelamin === "Perempuan" ? "P" : patient.jenis_kelamin === "Laki-laki" ? "L" : patient.jenis_kelamin || "");
      form.setValue("penerima_informasi_umur", umur);
      form.setValue("penerima_informasi_alamat", patient.alamat_ktp || patient.alamat_domisili || "");
      form.setValue("penerima_informasi_hubungan", "Diri Sendiri");
    }
  }, [source, pj, patient, form, readOnly]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [procRes, doctorsRes] = await Promise.all([
          proceduresApi.getAll({ is_active: true }),
          employeesApi.getLookup({ is_active: 'true' }),
        ]);

        if (procRes.data?.data) {
          setMasterProcedures(procRes.data.data);
        }

        if (doctorsRes.data?.data) {
          setDoctors(doctorsRes.data.data);
        }

        if (consentId) {
          try {
            const sigRes = await signatureApi.getDocumentSignature("INFORMED_CONSENT", consentId);
            setSigStatus(sigRes.data);
          } catch (e) {
            // ignore if not found
          }
        }

        if (consentId) {
          const consentRes = await medicalRecordsApi.getInformedConsentById(visitId, consentId);
          if (consentRes.data?.data) {
            const consent = consentRes.data.data;
            form.reset({
              ...consent,
              visit_id: visitId,
              penerima_informasi_source: consent.penerima_informasi_source || "manual",
            });

            if (consent.procedures) {
              const selected = consent.procedures
                .map((cp: any) => cp.procedure)
                .filter(Boolean) as Procedure[];

              const uniqueSelected = selected.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
              setSelectedProcedures(uniqueSelected);
            }

            const tList = [];
            if (consent.tindakan_1) tList.push(consent.tindakan_1);
            if (consent.tindakan_2) {
              // tindakan_2 might contain comma-separated list
              tList.push(...consent.tindakan_2.split(",").map(s => s.trim()).filter(Boolean));
            }
            setKeputusanTindakanList(tList);
          }
        } else {
          // Initialize for create new
          if (pj?.penanggung_jawab_nama) {
            form.setValue("penerima_informasi_source", "penanggung_jawab");
          }
          if (visitData?.dokter_id) {
            form.setValue("dokter_pemberi_informasi_id", visitData.dokter_id);
          }
        }
      } catch (err) {
        console.error("Failed to load informed consent data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [visitId, consentId, form]);

  const toggleProcedure = (proc: Procedure) => {
    if (readOnly) return;
    setSelectedProcedures((prev) => {
      const exists = prev.find(p => p.id === proc.id);
      if (exists) {
        return prev.filter(p => p.id !== proc.id);
      }
      return [...prev, proc];
    });
  };

  const onSubmit = async (data: InformedConsent) => {
    console.log("[InformedConsentForm] Raw data:", data);
    try {
      setSaving(true);

      const payload: InformedConsent = {
        ...data,
        info_diagnosis_kerja: !!data.info_diagnosis_kerja && data.info_diagnosis_kerja !== "0" as any,
        info_indikasi_tindakan: !!data.info_indikasi_tindakan && data.info_indikasi_tindakan !== "0" as any,
        info_tata_cara: !!data.info_tata_cara && data.info_tata_cara !== "0" as any,
        info_tujuan: !!data.info_tujuan && data.info_tujuan !== "0" as any,
        info_risiko: !!data.info_risiko && data.info_risiko !== "0" as any,
        info_komplikasi: !!data.info_komplikasi && data.info_komplikasi !== "0" as any,
        info_prognosis: !!data.info_prognosis && data.info_prognosis !== "0" as any,
        info_alternatif: !!data.info_alternatif && data.info_alternatif !== "0" as any,
        info_lain_lain: (!!data.info_lain_lain && data.info_lain_lain !== "0" as any) ? "1" : "0",
        jenis_tindakan: selectedProcedures.map(p => p.name).join(", "),
        procedures: selectedProcedures.map(p => ({
          procedure_id: p.id,
        })),
        tindakan_1: keputusanTindakanList.length > 0 ? keputusanTindakanList[0] : "",
        tindakan_2: keputusanTindakanList.length > 1 ? keputusanTindakanList.slice(1).join(", ") : "",
      };

      const res = await medicalRecordsApi.saveInformedConsent(visitId, payload);
      toast({
        title: "Tersimpan",
        description: "Informed Consent berhasil disimpan",
      });
      emitMedicalRecordTabSaved("informed-consent", true);
      if (onSaved) onSaved((res as any).data?.data?.id);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal",
        description: err.response?.data?.error || "Gagal menyimpan form",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const informationItems = [
    { key: "diagnosis_kerja", label: "Diagnosa Kerja", placeholder: "Sebutkan diagnosa..." },
    { key: "indikasi_tindakan", label: "Indikasi Tindakan", placeholder: "Alasan tindakan dilakukan..." },
    { key: "tata_cara", label: "Tata Cara", placeholder: "Langkah-langkah tindakan..." },
    { key: "tujuan", label: "Tujuan", placeholder: "Tujuan yang diharapkan..." },
    { key: "risiko", label: "Resiko Tindakan", placeholder: "Kemungkinan resiko yang terjadi..." },
    { key: "komplikasi", label: "Komplikasi", placeholder: "Kemungkinan komplikasi..." },
    { key: "prognosis", label: "Prognosis", placeholder: "Prediksi hasil tindakan..." },
    { key: "alternatif", label: "Alternatif & Resiko", placeholder: "Alternatif lain beserta resikonya..." },
    { key: "lain_lain", label: "Hal-hal lain (Penyelamatan/Perluasan/Resusitasi)", placeholder: "Informasi tambahan lainnya..." },
  ];

  return (
    <div className="space-y-6 max-w-full mx-auto pb-10">
      <form id="informed-consent-form" onSubmit={form.handleSubmit(onSubmit)} className="rounded-lg border border-border/70 bg-background overflow-hidden divide-y divide-border/70">

        <div>
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Judul Dokumen</span><span className="text-red-600 text-xs"> * (Wajib)</span>
          </div>
          <div className="p-3 sm:p-4">
            <div className="space-y-2">
              <Input
                {...form.register("judul_tindakan")}
                placeholder="Masukan Judul Persetujuan"
                className="font-medium"
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Dokter */}
        <div>
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">1. Pemberi Informasi</span>
          </div>
          <div className="p-3 sm:p-4">
            <div className="space-y-2">
              <Controller
                control={form.control}
                name="dokter_pemberi_informasi_id"
                render={({ field }) => (
                  <Combobox
                    options={doctors.map((d) => ({
                      value: d.id.toString(),
                      label: d.nama_lengkap,
                    }))}
                    value={field.value?.toString() || ""}
                    onValueChange={(val) => {
                      const newId = val ? Number(val) : null;
                      console.log("Combobox changed to:", newId);
                      toast({ title: "Dropdown Diklik", description: `Nilai baru: ${newId}` });
                      field.onChange(newId);
                    }}
                    placeholder="Pilih Pegawai..."
                    searchPlaceholder="Cari pegawai..."
                    emptyText="Pegawai tidak ditemukan"
                    disabled={readOnly}
                    className="w-full h-auto min-h-[2.5rem]"
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Tindakan Kedokteran */}
        <div>
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">2. Jenis Tindakan Kedokteran</span><span className="text-red-600 text-xs"> * (Wajib)</span>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <div className="space-y-2">
              <Popover open={procOpen && !readOnly} onOpenChange={setProcOpen}>
                <PopoverTrigger asChild>
                  <Button disabled={readOnly} variant="outline" role="combobox" aria-expanded={procOpen} className="w-full justify-between min-h-[2.5rem] h-auto p-2">
                    <span className="text-muted-foreground px-2">Pilih Tindakan...</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Cari master tindakan..." />
                    <CommandList>
                      <CommandEmpty>Tidak ada tindakan ditemukan.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {masterProcedures.map((proc) => (
                          <CommandItem
                            key={proc.id}
                            value={proc.name}
                            onSelect={() => {
                              toggleProcedure(proc);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProcedures.some(p => p.id === proc.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {proc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedProcedures.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="h-10 px-4 text-left font-medium">Nama Tindakan</th>
                      {!readOnly && (
                        <th className="h-10 w-[80px] px-4 text-center font-medium">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedProcedures.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">{p.name}</td>
                        {!readOnly && (
                          <td className="px-4 py-3 flex justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => toggleProcedure(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground bg-muted/10">
                Belum ada tindakan yang dipilih
              </div>
            )}
          </div>
        </div>

        {/* Penerima Informasi */}
        <div>
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">3. Penerima Informasi</span><span className="text-red-600 text-xs"> * (Wajib)</span>
          </div>
          <div className="p-3 sm:p-4 space-y-6">
            {!readOnly && (
              <div className="space-y-3">
                <Controller
                  control={form.control}
                  name="penerima_informasi_source"
                  render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 flex-wrap">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="diri_sendiri" id="source_diri_sendiri" />
                        <Label htmlFor="source_diri_sendiri">Diri Sendiri (Pasien)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="penanggung_jawab" id="source_pj" />
                        <Label htmlFor="source_pj">Dari Penanggung Jawab Pasien</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="source_manual" />
                        <Label htmlFor="source_manual">Input Manual</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            )}

            {source === "penanggung_jawab" && !pj?.penanggung_jawab_nama && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Data Tidak Tersedia</AlertTitle>
                <AlertDescription>
                  Pasien ini tidak memiliki data Penanggung Jawab pada saat pendaftaran. Silakan ubah ke mode Input Manual.
                </AlertDescription>
              </Alert>
            )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label>Nama Terang</Label>
                  <Input {...form.register("penerima_informasi_nama")} disabled={readOnly || source === "penanggung_jawab"} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label>Hubungan dengan Pasien</Label>
                  <Controller
                    control={form.control}
                    name="penerima_informasi_hubungan"
                    render={({ field }) => (
                      <Combobox
                        options={HUBUNGAN_OPTIONS}
                        value={field.value ? String(field.value).replace(/\s+/g, "_") : ""}
                        onValueChange={(val) => field.onChange(val ? val.replace(/_/g, " ") : "")}
                        disabled={readOnly || source === "penanggung_jawab" || source === "diri_sendiri"}
                        placeholder="Pilih hubungan..."
                        className="w-full h-9"
                      />
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label>No. Identitas (KTP/SIM)</Label>
                  <Input {...form.register("penerima_informasi_no_identitas")} disabled={readOnly || source === "penanggung_jawab"} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label>No. Telepon</Label>
                  <Input {...form.register("penerima_informasi_no_telp")} disabled={readOnly || source === "penanggung_jawab"} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label>Umur (Tahun)</Label>
                  <Controller
                    control={form.control}
                    name="penerima_informasi_umur"
                    render={({ field }) => (
                      <Input
                        type="number"
                        disabled={readOnly || source === "penanggung_jawab"}
                        value={field.value || ""}
                        className="h-9"
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          field.onChange(isNaN(parsed) ? undefined : parsed);
                        }}
                      />
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Jenis Kelamin</Label>
                  <Controller
                    control={form.control}
                    name="penerima_informasi_jk"
                    render={({ field }) => (
                      <Combobox
                        key={`jk-${field.value || "empty"}`}
                        options={JK_OPTIONS}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={readOnly || source === "penanggung_jawab"}
                        placeholder="Pilih jenis kelamin..."
                        className="w-full h-9"
                      />
                    )}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Alamat Lengkap</Label>
                  <Input {...form.register("penerima_informasi_alamat")} disabled={readOnly || source === "penanggung_jawab"} className="h-9" />
                </div>
              </div>
          </div>
        </div>

        {/* Informasi yang Disampaikan */}
        <div>
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">4. Rincian Informasi yang Disampaikan</span>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <div className="border border-border/70">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/10 border-b border-border/70">
                  <tr>
                    <th className="px-3 py-2 font-medium w-1/3 border-r border-border/70">Jenis Informasi</th>
                    <th className="px-3 py-2 font-medium">Isi / Penjelasan</th>
                    <th className="px-3 py-2 font-medium w-24 text-center border-l border-border/70">Checklist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {informationItems.map((item) => (
                    <tr key={item.key} className="bg-transparent hover:bg-slate-50/50">
                      <td className="px-3 py-2 align-top border-r border-border/70">
                        {item.label}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Textarea
                          {...form.register(`isi_${item.key}` as any)}
                          placeholder={item.placeholder}
                          className="min-h-12 resize-none bg-transparent p-0 placeholder:text-muted-foreground/50 leading-relaxed !border-0 !ring-0 !shadow-none !outline-none focus:!border-0 focus:!ring-0 focus:!outline-none focus-visible:!border-0 focus-visible:!ring-0 focus-visible:!outline-none rounded-none"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-3 py-2 align-top border-l border-border/70">
                        <Controller
                          control={form.control}
                          name={`info_${item.key}` as any}
                          render={({ field }) => (
                            <div className="flex justify-center mt-1">
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded border cursor-pointer transition-colors ${field.value ? 'bg-primary border-primary' : 'border-input hover:bg-accent'}`}
                                onClick={() => !readOnly && field.onChange(!field.value)}
                              >
                                {field.value && <Check className="text-white w-3.5 h-3.5" />}
                              </div>
                            </div>
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 space-y-4 mt-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-900 rounded-md border border-blue-100">
                <Controller
                  control={form.control}
                  name="pernyataan_dokter"
                  render={({ field }) => (
                    <Checkbox disabled={readOnly} id="pernyataan_dokter" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="pernyataan_dokter" className="leading-snug cursor-pointer">
                  Dengan ini saya (Dokter) menyatakan telah menerangkan hal-hal diatas secara benar, jelas dan memberikan kesempatan untuk bertanya.
                </Label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-green-50 text-green-900 rounded-md border border-green-100">
                <Controller
                  control={form.control}
                  name="stmt_menerima_penjelasan"
                  render={({ field }) => (
                    <Checkbox disabled={readOnly} id="stmt_menerima_penjelasan" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="stmt_menerima_penjelasan" className="leading-snug cursor-pointer">
                  Dengan ini saya (Pasien/Keluarga) menyatakan telah menerima dan memahami informasi dari dokter sebagaimana di atas.
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Persetujuan atau Penolakan */}
        <div className="bg-background">
          <div className="border-b border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">5. Pernyataan Persetujuan / Penolakan Tindakan</span>
          </div>
          <div className="p-3 sm:p-4 space-y-6">

            <div className="space-y-4">
              <Controller
                control={form.control}
                name="persetujuan_tindakan"
                render={({ field }) => (
                  <RadioGroup disabled={readOnly} onValueChange={field.onChange} value={field.value} className="flex gap-6">
                    <div className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-slate-50 flex-1">
                      <RadioGroupItem value="menyetujui" id="menyetujui" />
                      <Label htmlFor="menyetujui" className="font-bold text-green-700 cursor-pointer">SAYA MENYETUJUI TINDAKAN KEDOKTERAN</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-slate-50 flex-1">
                      <RadioGroupItem value="menolak" id="menolak" />
                      <Label htmlFor="menolak" className="font-bold text-red-700 cursor-pointer">SAYA MENOLAK TINDAKAN KEDOKTERAN</Label>
                    </div>
                  </RadioGroup>
                )}
              />

              <div className="space-y-3 pt-2">
                <Label>Untuk dilakukan tindakan kedokteran berupa:</Label>
                <div className="flex gap-2">
                  <Input
                    disabled={readOnly}
                    value={keputusanTindakanInput}
                    onChange={(e) => setKeputusanTindakanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (keputusanTindakanInput.trim()) {
                          setKeputusanTindakanList([...keputusanTindakanList, keputusanTindakanInput.trim()]);
                          setKeputusanTindakanInput("");
                        }
                      }
                    }}
                    placeholder="Ketik deskripsi tindakan dan tekan Enter..."
                    className="flex-1"
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      disabled={!keputusanTindakanInput.trim()}
                      onClick={() => {
                        if (keputusanTindakanInput.trim()) {
                          setKeputusanTindakanList([...keputusanTindakanList, keputusanTindakanInput.trim()]);
                          setKeputusanTindakanInput("");
                        }
                      }}
                    >
                      Tambah
                    </Button>
                  )}
                </div>

                {keputusanTindakanList.length > 0 && (
                  <div className="rounded-md border overflow-hidden mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="h-10 px-4 text-center font-medium w-12">No</th>
                          <th className="h-10 px-4 text-left font-medium">Deskripsi Tindakan</th>
                          {!readOnly && (
                            <th className="h-10 w-[80px] px-4 text-center font-medium">Aksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {keputusanTindakanList.map((t, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium">{t}</td>
                            {!readOnly && (
                              <td className="px-4 py-3 flex justify-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setKeputusanTindakanList(keputusanTindakanList.filter((_, i) => i !== idx));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 text-yellow-900 p-4 rounded-md border border-yellow-200 text-sm italic">
              "Saya memahami perlunya dan manfaat tindakan tersebut sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk resiko dan komplikasi yang mungkin timbul apabila tindakan tersebut dilakukan."
            </div>

          </div>
        </div>

        {/* Daftar Saksi & Petugas */}
        <div className="space-y-4">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">6. Tanda Tangan & Petugas Pendukung</span>
          </div>

          <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { id: "pasien", label: "Pasien / PJ" },
              { id: "dokter", label: "Dokter Pelaksana" },
              { id: "perawat", label: "Perawat" },
              { id: "saksi1", label: "Saksi I" },
              { id: "saksi2", label: "Saksi II" }
            ].map((slot) => {
              const isSigned = sigStatus?.signed_slots?.[slot.id];
              const detail = sigStatus?.slot_details?.[slot.id];
              return (
                <div key={slot.id} className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-semibold text-center block w-full truncate" title={slot.label}>{slot.label}</Label>
                  <div
                    onClick={async () => {
                      if (readOnly) return;

                      if (isSigned) {
                        setRevokeConfirmSlot({ id: slot.id, label: slot.label });
                        return;
                      }

                      if (!consentId) {
                        toast({ variant: "destructive", title: "Belum Disimpan", description: "Harap klik Submit untuk menyimpan form persetujuan ini terlebih dahulu sebelum mengisi tanda tangan." });
                        return;
                      }

                      if (slot.id === "dokter" || slot.id === "perawat") {
                        setSignState({ slot: slot.id, step: "employee", name: "" });
                      } else {
                        let defaultName = "";
                        if (slot.id === "pasien") defaultName = form.getValues("penerima_informasi_nama") || "";
                        if (slot.id === "saksi1") defaultName = form.getValues("saksi_1_nama") || "";
                        if (slot.id === "saksi2") defaultName = form.getValues("saksi_2_nama") || "";

                        setSignState({ slot: slot.id, step: "name", name: defaultName });
                      }
                    }}
                    className={cn(
                      "h-32 border-2 rounded-lg flex flex-col items-center justify-center transition-all",
                      isSigned
                        ? "border-green-500 bg-green-50 text-green-700 cursor-default"
                        : readOnly ? "border-dashed border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed" : "border-dashed border-gray-300 hover:border-primary hover:bg-muted cursor-pointer"
                    )}
                  >
                    {isSigned ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 mb-2 text-green-500" />
                        <span className="text-[10px] font-medium px-2 text-center break-words w-full line-clamp-2" title={detail?.signed_by_name || detail?.signer_name}>
                          {detail?.signed_by_name || detail?.signer_name || "Telah Ditandatangani"}
                        </span>
                        {detail?.signed_at && (
                          <span className="text-[9px] mt-1 opacity-70">
                            {new Date(detail.signed_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <PenTool className="w-6 h-6 mb-2 opacity-40" />
                        <span className="text-[10px] font-medium opacity-60 text-center px-2">Klik untuk<br />Tanda Tangan</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons (Hidden, triggered by show.tsx footer) */}
        <button type="submit" className="hidden" disabled={saving || readOnly}>
          Submit
        </button>
      </form>

      {signState?.step === "name" && (
        <NameInputDialog
          initialName={signState.name}
          onCancel={() => setSignState(null)}
          onConfirm={(name) => {
            // Save to form temporary
            if (signState.slot === 'pasien') form.setValue('penerima_informasi_nama', name);
            if (signState.slot === 'saksi1') form.setValue('saksi_1_nama', name);
            if (signState.slot === 'saksi2') form.setValue('saksi_2_nama', name);
            setSignState({ ...signState, step: "canvas", name });
          }}
        />
      )}

      {signState?.step === "canvas" && (
        <Dialog open={true} onOpenChange={(v) => !v && setSignState(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-[1000px] h-[85vh] flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Tanda Tangan: {signState.name}</DialogTitle>
            </DialogHeader>
            <div className="border rounded-lg bg-slate-50 flex-1 relative overflow-hidden">
              <SignatureCanvas
                ref={sigPad}
                canvasProps={{ className: "w-full h-full cursor-crosshair" }}
              />
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => sigPad.current?.clear()} disabled={isSigning}>
                Ulangi
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSignState(null)} disabled={isSigning}>Batal</Button>
                <Button onClick={async () => {
                  if (sigPad.current?.isEmpty()) {
                    toast({ variant: "destructive", title: "Tanda tangan masih kosong" });
                    return;
                  }
                  setIsSigning(true);
                  try {
                    const base64 = sigPad.current?.toDataURL();
                    const linkRes = await signatureApi.getPatientLink("INFORMED_CONSENT", consentId!, signState.name, signState.slot);
                    await api.post("/signature/submit", {
                      token: linkRes.data.token,
                      signature_image: base64,
                      photo_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                    });

                    // Update form signed name fields
                    const payload = { ...form.getValues() };
                    if (signState.slot === 'pasien') payload.signer_name_pasien = signState.name;
                    if (signState.slot === 'saksi1') payload.signer_name_saksi1 = signState.name;
                    if (signState.slot === 'saksi2') payload.signer_name_saksi2 = signState.name;

                    form.reset(payload);
                    await medicalRecordsApi.saveInformedConsent(visitId, payload).catch(() => { });

                    const sigRes = await signatureApi.getDocumentSignature("INFORMED_CONSENT", consentId!);
                    setSigStatus(sigRes.data);

                    setSignState(null);
                    toast({ title: "Berhasil", description: "Tanda tangan disimpan" });
                  } catch (e) {
                    toast({ variant: "destructive", title: "Gagal menyimpan", description: "Terjadi kesalahan" });
                  } finally {
                    setIsSigning(false);
                  }
                }} disabled={isSigning}>
                  {isSigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Simpan Tanda Tangan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {signState?.step === "employee" && (
        <EmployeeSignatureDialog
          open={true}
          onOpenChange={(v) => !v && setSignState(null)}
          documentType="INFORMED_CONSENT"
          documentId={consentId!}
          visitId={visitId}
          role={signState.slot === "dokter" ? "dokter" : "perawat"}
          title={signState.slot === "dokter" ? "Tanda Tangan Dokter Pelaksana" : "Tanda Tangan Perawat"}
          onSuccess={async () => {
            setSignState(null);
            try {
              const sigRes = await signatureApi.getDocumentSignature("INFORMED_CONSENT", consentId!);
              setSigStatus(sigRes.data);
            } catch (e) { }
          }}
        />
      )}

      <AlertDialog open={!!revokeConfirmSlot} onOpenChange={(open) => !open && setRevokeConfirmSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tanda Tangan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tanda tangan {revokeConfirmSlot?.label}? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!revokeConfirmSlot) return;
                try {
                  await signatureApi.revokePatientSignature("INFORMED_CONSENT", consentId!, revokeConfirmSlot.id);
                  const sigRes = await signatureApi.getDocumentSignature("INFORMED_CONSENT", consentId!);
                  setSigStatus(sigRes.data);
                  toast({ title: "Berhasil", description: "Tanda tangan berhasil dihapus." });
                } catch (e) {
                  toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus tanda tangan." });
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

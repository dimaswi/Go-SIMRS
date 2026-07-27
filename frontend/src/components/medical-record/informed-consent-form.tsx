import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type InformedConsent } from "@/lib/api/medical-records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { emitMedicalRecordTabSaved } from "./tab-indicator";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { DOCUMENT_TYPES } from "@/lib/api/signature";
import { Textarea } from "@/components/ui/textarea";

interface InformedConsentFormProps {
  visitId: number;
}

export function InformedConsentForm({ visitId }: InformedConsentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const form = useForm<InformedConsent>({
    defaultValues: {
      visit_id: visitId,
      jenis_tindakan: "",
      penerima_informasi_nama: "",
      penerima_informasi_umur: 0,
      penerima_informasi_jk: "",
      penerima_informasi_alamat: "",
      penerima_informasi_hubungan: "",

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

  useEffect(() => {
    const fetchConsent = async () => {
      try {
        setLoading(true);
        const res = await medicalRecordsApi.getInformedConsent(visitId);
        if (res.data?.data) {
          form.reset({
            ...res.data.data,
            visit_id: visitId,
          });
        }
      } catch (err) {
        console.error("Failed to load informed consent", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConsent();
  }, [visitId, form]);

  const onSubmit = async (data: InformedConsent) => {
    try {
      setSaving(true);
      await medicalRecordsApi.saveInformedConsent(visitId, data);
      toast({
        title: "Tersimpan",
        description: "Informed Consent berhasil disimpan",
      });
      emitMedicalRecordTabSaved("informed-consent", true);
      setSignDialogOpen(true);
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

  if (signDialogOpen) {
    return (
      <div className="w-full flex flex-col h-full min-h-[500px]">
        <SequentialSignatureWizard
          visitId={visitId}
          documentId={form.getValues("id") as number}
          documentType={DOCUMENT_TYPES.INFORMED_CONSENT}
          documentTitle="Informed Consent"
          steps={[
            { role: "pasien", title: "Tanda Tangan Pasien/Wali", type: "patient_or_family" },
            { role: "dokter", title: "Tanda Tangan Dokter", type: "employee" },
            { role: "perawat", title: "Tanda Tangan Perawat", type: "employee" },
            { role: "saksi1", title: "Tanda Tangan Saksi 1", type: "patient_or_family" },
            { role: "saksi2", title: "Tanda Tangan Saksi 2", type: "patient_or_family" },
          ]}
          onStepSuccess={async (role, name) => {
            const currentData = form.getValues();
            const updatedFields: Partial<InformedConsent> = {};
            switch (role) {
              case "pasien": updatedFields.signer_name_pasien = name; break;
              case "dokter": updatedFields.signer_name_dokter = name; break;
              case "perawat": updatedFields.signer_name_perawat = name; break;
              case "saksi1": updatedFields.signer_name_saksi1 = name; break;
              case "saksi2": updatedFields.signer_name_saksi2 = name; break;
            }
            try {
              await medicalRecordsApi.saveInformedConsent(visitId, { ...currentData, ...updatedFields });
              form.reset({ ...currentData, ...updatedFields });
            } catch (e) {
              console.error(e);
            }
          }}
          onSuccess={async () => {
            try {
              await medicalRecordsApi.saveInformedConsent(visitId, { ...form.getValues(), is_fully_signed: true });
              emitMedicalRecordTabSaved("informed-consent", true);
              setSignDialogOpen(false);
            } catch (e) {
              console.error(e);
            }
          }}
          onCancel={() => setSignDialogOpen(false)}
        />
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
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="bg-muted/30 p-4 rounded-md border text-sm space-y-2">
        <p className="font-semibold text-foreground text-lg uppercase">Informed Consent (Persetujuan Tindakan)</p>
        <p className="text-muted-foreground">Isi formulir persetujuan ini dengan jelas. Detail akan digunakan saat pencetakan dokumen PDF.</p>
      </div>

      <form id="informed-consent-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Identitas Pihak */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base">1. Identitas & Pemberian Informasi</CardTitle>
            <CardDescription>Siapa yang memberikan dan menerima informasi medis ini.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Jenis Tindakan Kedokteran <span className="text-red-500">*</span></Label>
                <Input {...form.register("jenis_tindakan")} placeholder="Contoh: Operasi Katarak, Pasang Infus..." />
              </div>
              <div className="space-y-2">
                <Label>ID / Kode Dokter Pemberi Informasi</Label>
                <Input type="number" {...form.register("dokter_pemberi_informasi_id", { valueAsNumber: true })} placeholder="ID Dokter di sistem" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Hubungan Penerima dengan Pasien</Label>
                <Input {...form.register("penerima_informasi_hubungan")} placeholder="Contoh: Pasien Sendiri, Suami, Ayah..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informasi yang Disampaikan */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base">2. Rincian Informasi yang Disampaikan</CardTitle>
            <CardDescription>Centang bagian kanan jika informasi tersebut sudah disampaikan dan dipahami dengan jelas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {informationItems.map((item, index) => (
              <div key={item.key} className="flex items-start gap-4 p-3 border rounded-md bg-white hover:bg-slate-50 transition-colors">
                <div className="w-6 pt-1.5 font-medium text-muted-foreground">{index + 1}.</div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-primary">{item.label}</Label>
                  <Textarea
                    {...form.register(`isi_${item.key}` as any)}
                    placeholder={item.placeholder}
                    className="min-h-10 resize-y shadow-none bg-white"
                  />
                </div>
                <div className="w-32 flex flex-col items-center justify-center pt-2 gap-2 border-l pl-4">
                  <span className="text-xs text-center text-muted-foreground">Sudah dijelaskan?</span>
                  <Controller
                    control={form.control}
                    name={`info_${item.key}` as any}
                    render={({ field }) => (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors cursor-pointer ${field.value ? 'bg-primary border-primary' : 'bg-transparent border-input hover:border-primary'}`} onClick={() => field.onChange(!field.value)}>
                        {field.value && <CheckCircle2 className="text-white w-6 h-6" />}
                      </div>
                    )}
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 space-y-4 mt-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-900 rounded-md border border-blue-100">
                <Controller
                  control={form.control}
                  name="pernyataan_dokter"
                  render={({ field }) => (
                    <Checkbox id="pernyataan_dokter" checked={field.value} onCheckedChange={field.onChange} />
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
                    <Checkbox id="stmt_menerima_penjelasan" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="stmt_menerima_penjelasan" className="leading-snug cursor-pointer">
                  Dengan ini saya (Pasien/Keluarga) menyatakan telah menerima dan memahami informasi dari dokter sebagaimana di atas.
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Persetujuan atau Penolakan */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-3 border-b bg-primary/5 text-primary">
            <CardTitle className="text-base">3. Pernyataan Persetujuan / Penolakan Tindakan</CardTitle>
            <CardDescription className="text-primary/70">Keputusan akhir dari pihak pasien atau keluarga terkait tindakan yang akan dilakukan.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">

            <div className="bg-slate-50 p-4 rounded-md border space-y-4">
              <Label className="text-base font-semibold block border-b pb-2">Identitas Pihak yang Menyatakan (Wali/Pasien)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Terang</Label>
                  <Input {...form.register("penerima_informasi_nama")} placeholder="Masukkan nama..." className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Alamat Lengkap</Label>
                  <Input {...form.register("penerima_informasi_alamat")} placeholder="Masukkan alamat..." className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Umur (Tahun)</Label>
                  <Input type="number" {...form.register("penerima_informasi_umur", { valueAsNumber: true })} placeholder="Umur..." className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin</Label>
                  <Controller
                    control={form.control}
                    name="penerima_informasi_jk"
                    render={({ field }) => (
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="L" id="penerima_L" />
                          <Label htmlFor="penerima_L">Laki-laki</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="P" id="penerima_P" />
                          <Label htmlFor="penerima_P">Perempuan</Label>
                        </div>
                      </RadioGroup>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Keputusan Tindakan</Label>
              <Controller
                control={form.control}
                name="persetujuan_tindakan"
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
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
                <div className="flex items-center gap-3">
                  <span className="font-bold text-muted-foreground w-6 text-right">1.</span>
                  <Input {...form.register("tindakan_1")} placeholder="Deskripsi tindakan pertama..." className="flex-1" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-muted-foreground w-6 text-right">2.</span>
                  <Input {...form.register("tindakan_2")} placeholder="Deskripsi tindakan kedua (opsional)..." className="flex-1" />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 text-yellow-900 p-4 rounded-md border border-yellow-200 text-sm italic">
              "Saya memahami perlunya dan manfaat tindakan tersebut sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk resiko dan komplikasi yang mungkin timbul apabila tindakan tersebut dilakukan."
            </div>

          </CardContent>
        </Card>

        {/* Daftar Saksi & Petugas */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base">4. Petugas & Saksi Pendukung</CardTitle>
            <CardDescription>Nama-nama yang akan muncul pada bagian tanda tangan dokumen PDF.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Nama Perawat (Opsional)</Label>
              <Input {...form.register("perawat_nama")} placeholder="Masukkan nama perawat..." />
            </div>
            <div className="space-y-2">
              <Label>Nama Saksi I (Opsional)</Label>
              <Input {...form.register("saksi_1_nama")} placeholder="Masukkan nama saksi 1..." />
            </div>
            <div className="space-y-2">
              <Label>Nama Saksi II (Opsional)</Label>
              <Input {...form.register("saksi_2_nama")} placeholder="Masukkan nama saksi 2..." />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-end gap-3 mt-8 z-10">
          <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto font-bold px-8">
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Lanjut Tanda Tangan"}
            {!saving && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

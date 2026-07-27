import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type InformedConsent } from "@/lib/api/medical-records";
import { DOCUMENT_TYPES } from "@/lib/api/signature";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { SignOnBehalfDialog } from "@/components/signature/sign-on-behalf-dialog";
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
      persetujuan_tindakan: "menyetujui",
      penerima_informasi_jk: "L",
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
      setSignDialogOpen(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan form",
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="bg-muted/30 p-4 rounded-md border text-sm space-y-2">
        <p className="font-semibold text-foreground text-lg uppercase">Persetujuan / Penolakan Tindakan Kedokteran</p>
        <p className="text-muted-foreground">Isi form pemberian informasi, lalu pilih persetujuan atau penolakan tindakan kedokteran.</p>
      </div>

      <form id="informed-consent-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Pemberian Informasi */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base">1. Pemberian Informasi</CardTitle>
            <CardDescription>Catat hal-hal apa saja yang telah diinformasikan kepada pasien/keluarga.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Diagnosis (WD & DD)</Label>
                <Textarea {...form.register("isi_diagnosis_kerja")} placeholder="Diagnosis Kerja & Diagnosis Banding..." />
              </div>
              <div className="space-y-2">
                <Label>Dasar Diagnosis</Label>
                <Textarea {...form.register("isi_lain_lain")} placeholder="Hasil pemeriksaan klinis, lab, dll..." />
              </div>
              <div className="space-y-2">
                <Label>Tindakan Kedokteran</Label>
                <Textarea {...form.register("jenis_tindakan")} placeholder="Jenis tindakan yang akan dilakukan..." />
              </div>
              <div className="space-y-2">
                <Label>Indikasi Tindakan</Label>
                <Textarea {...form.register("isi_indikasi_tindakan")} placeholder="Alasan mengapa tindakan diperlukan..." />
              </div>
              <div className="space-y-2">
                <Label>Tata Cara</Label>
                <Textarea {...form.register("isi_tata_cara")} placeholder="Langkah-langkah tindakan..." />
              </div>
              <div className="space-y-2">
                <Label>Tujuan</Label>
                <Textarea {...form.register("isi_tujuan")} placeholder="Tujuan dilakukannya tindakan..." />
              </div>
              <div className="space-y-2">
                <Label>Risiko & Komplikasi</Label>
                <Textarea {...form.register("isi_risiko")} placeholder="Risiko yang mungkin terjadi..." />
              </div>
              <div className="space-y-2">
                <Label>Prognosis</Label>
                <Textarea {...form.register("isi_prognosis")} placeholder="Prognosis setelah tindakan..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Alternatif & Risikonya</Label>
                <Textarea {...form.register("isi_alternatif")} placeholder="Alternatif tindakan lain dan risikonya..." />
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-900 rounded-md border border-blue-100">
                <Controller
                  control={form.control}
                  name="pernyataan_dokter"
                  render={({ field }) => (
                    <Checkbox id="stmt_memberikan_penjelasan" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="stmt_memberikan_penjelasan" className="leading-snug cursor-pointer font-medium">
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
                <Label htmlFor="stmt_menerima_penjelasan" className="leading-snug cursor-pointer font-medium">
                  Dengan ini saya (Pasien/Keluarga) menyatakan telah menerima dan memahami informasi dari dokter sebagaimana di atas.
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Persetujuan atau Penolakan */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-3 border-b bg-primary/5 text-primary">
            <CardTitle className="text-base">2. Pernyataan Persetujuan / Penolakan Tindakan</CardTitle>
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
                    <div className={`flex items-center space-x-2 p-4 border-2 rounded-md cursor-pointer flex-1 transition-all ${field.value === 'menyetujui' ? 'border-green-600 bg-green-50' : 'hover:bg-slate-50'}`}>
                      <RadioGroupItem value="menyetujui" id="menyetujui" className="text-green-600" />
                      <Label htmlFor="menyetujui" className="font-bold text-green-700 cursor-pointer w-full text-center text-lg">SAYA MENYETUJUI<br/><span className="text-sm font-normal">Tindakan Kedokteran</span></Label>
                    </div>
                    <div className={`flex items-center space-x-2 p-4 border-2 rounded-md cursor-pointer flex-1 transition-all ${field.value === 'menolak' ? 'border-red-600 bg-red-50' : 'hover:bg-slate-50'}`}>
                      <RadioGroupItem value="menolak" id="menolak" className="text-red-600" />
                      <Label htmlFor="menolak" className="font-bold text-red-700 cursor-pointer w-full text-center text-lg">SAYA MENOLAK<br/><span className="text-sm font-normal">Tindakan Kedokteran</span></Label>
                    </div>
                  </RadioGroup>
                )}
              />
              
              <div className="space-y-3 pt-2">
                <Label>Untuk dilakukan tindakan kedokteran berupa:</Label>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-muted-foreground w-6 text-right">1.</span>
                  <Input {...form.register("tindakan_1")} placeholder="Deskripsi tindakan pertama..." className="flex-1 border-primary/20 bg-primary/5" />
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
            <CardTitle className="text-base">3. Petugas & Saksi Pendukung</CardTitle>
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

        {/* Action Buttons (Wizard Style) */}
        <div className="flex justify-end gap-3 pt-6 border-t mt-8">
          <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto font-bold px-8">
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Lanjut Tanda Tangan"}
            {!saving && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </form>

      <SignOnBehalfDialog
        open={signDialogOpen}
        onOpenChange={setSignDialogOpen}
        documentType={DOCUMENT_TYPES.INFORMED_CONSENT}
        documentId={visitId}
        visitId={visitId}
        documentTitle="Persetujuan Tindakan Kedokteran"
        signerHint="Silakan lengkapi Tanda Tangan"
        slotLabels={{ left: "Petugas/Dokter", right: "Pasien/Keluarga" }}
      />
    </div>
  );
}

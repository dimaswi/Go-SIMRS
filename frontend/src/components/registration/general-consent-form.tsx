import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsent } from "@/lib/api/medical-records";
import { DOCUMENT_TYPES, signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Printer, Trash2, FileText, CheckCircle2, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ConsentKopHeader } from "./consent-kop-header";

interface GeneralConsentFormProps {
  visitId: number;
}

export function GeneralConsentForm({ visitId }: GeneralConsentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<DocumentSignatureStatus | null>(null);
  const [consentId, setConsentId] = useState<number | null>(null);

  const form = useForm<GeneralConsent>({
    defaultValues: {
      visit_id: visitId,
      signer_relation: "pasien",
      signer_name: "",
      pj_nama: "",
      pj_umur: undefined,
      pj_jenis_kelamin: "",
      pj_alamat: "",
      pj_no_identitas: "",
      pj_no_telp: "",
      pj_hubungan: "",
      authorized_persons: [],
    },
  });

  useEffect(() => {
    const fetchConsent = async () => {
      try {
        setLoading(true);
        const res = await medicalRecordsApi.getGeneralConsent(visitId);
        if (res.data?.data) {
          form.reset({
            ...res.data.data,
            visit_id: visitId,
            authorized_persons: res.data.data.authorized_persons || [],
          });

          try {
            if (res.data.data.id) {
              setConsentId(res.data.data.id);
              const sigRes = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT, Number(visitId));
              setSignatureStatus(sigRes.data);
            }
          } catch {
            console.error("No signature found");
          }
        }
      } catch (err) {
        console.error("Failed to load general consent", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConsent();
  }, [visitId, form]);

  const onSubmit = async (data: GeneralConsent) => {
    try {
      setSaving(true);
      const saveRes = await medicalRecordsApi.saveGeneralConsent(visitId, data);

      if (saveRes.data?.data?.id) {
        form.setValue("id", saveRes.data.data.id);
        setConsentId(saveRes.data.data.id);
      }

      toast({
        title: "Tersimpan",
        description: "General Consent berhasil disimpan",
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

  const handlePrint = () => {
    const apiUrl =
      import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:8080/api`
        : "http://localhost:8080/api");
    const token = localStorage.getItem("token");
    window.open(`${apiUrl}/print/general-consent/${visitId}?token=${token}`, "_blank");
  };

  const isFullySigned = signatureStatus?.is_fully_signed || false;
  const signerName = form.watch("signer_name") || form.watch("pj_nama");

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (signDialogOpen && consentId) {
    return (
      <div className="w-full flex flex-1 flex-col min-h-0 overflow-y-auto p-4 sm:p-6">
        <SequentialSignatureWizard
          visitId={visitId}
          documentId={Number(visitId)}
          documentType={DOCUMENT_TYPES.GENERAL_CONSENT}
          documentTitle="Persetujuan Umum (RM-02)"
          steps={[
            { role: "right", title: "Tanda Tangan Penanggung Jawab", type: "patient_or_family" },
            { role: "left", title: "Tanda Tangan Petugas", type: "employee" },
          ]}
          onStepSuccess={async (role, name) => {
            const currentData = form.getValues();
            const updatedFields: Partial<GeneralConsent> = {};
            if (role === "right" || role === "pasien") updatedFields.signer_name = name;

            try {
              await medicalRecordsApi.saveGeneralConsent(visitId, { ...currentData, ...updatedFields });
              form.reset({ ...currentData, ...updatedFields });
            } catch (e) {
              console.error(e);
            }
          }}
          onSuccess={async () => {
            try {
              await medicalRecordsApi.saveGeneralConsent(visitId, { ...form.getValues() });

              if (consentId) {
                const sigRes = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT, Number(visitId));
                setSignatureStatus(sigRes.data);
              }
            } catch (e) {
              console.error("Failed to update signature status after save:", e);
            } finally {
              setSignDialogOpen(false);
            }
          }}
          renderCustomPatientModal={({ open, onClose }) => (
            <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
              <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh] rounded-none">
                <DialogHeader>
                  <DialogTitle>Data Penanggung Jawab (Yang Menyatakan)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nama Penanggung Jawab</Label>
                      <Input {...form.register("pj_nama")} placeholder="Nama lengkap..." className="rounded-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Umur (Tahun)</Label>
                        <Controller
                          control={form.control}
                          name="pj_umur"
                          render={({ field }) => (
                            <Input
                              type="number"
                              placeholder="Umur..."
                              className="rounded-none"
                              value={field.value || ""}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                field.onChange(isNaN(parsed) ? undefined : parsed);
                              }}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Jenis Kelamin</Label>
                        <Select
                          value={form.watch("pj_jenis_kelamin")}
                          onValueChange={(v) => form.setValue("pj_jenis_kelamin", v)}
                        >
                          <SelectTrigger className="rounded-none">
                            <SelectValue placeholder="Pilih..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                            <SelectItem value="Perempuan">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>No. Identitas (KTP/SIM)</Label>
                      <Input {...form.register("pj_no_identitas")} placeholder="Nomor identitas..." className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label>No. Telepon</Label>
                      <Input {...form.register("pj_no_telp")} placeholder="Nomor telepon..." className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label>Hubungan dengan Pasien</Label>
                      <Input {...form.register("pj_hubungan")} placeholder="Contoh: Suami/Istri/Anak/dll..." className="rounded-none" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Alamat Lengkap</Label>
                      <Textarea {...form.register("pj_alamat")} placeholder="Alamat lengkap..." className="min-h-[80px] rounded-none" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="rounded-none" onClick={() => onClose()}>Batal</Button>
                  <Button
                    className="rounded-none"
                    onClick={() => {
                      const name = form.getValues("pj_nama");
                      if (!name || name.trim() === "") {
                        toast({ variant: "destructive", title: "Nama Penanggung Jawab wajib diisi" });
                        return;
                      }
                      onClose(name);
                    }}
                  >
                    Simpan &amp; Lanjutkan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          onCancel={() => setSignDialogOpen(false)}
        />
      </div>
    );
  }

  return (
    <form
      id="general-consent-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 min-h-0 flex-col overflow-hidden"
    >
      {/* Top Document Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="w-3.5 h-3.5 text-neutral-500" />
          <span className="font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
            Persetujuan Umum
          </span>
          <Badge variant="outline" className="rounded-none font-mono text-[10px]">
            RM-02
          </Badge>
        </div>

        {isFullySigned ? (
          <Badge className="rounded-none border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sudah Ditandatangani
          </Badge>
        ) : (
          <Badge className="rounded-none border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 text-[11px] font-medium">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Tanda Tangan
          </Badge>
        )}
      </div>

      {/* Scrollable Legal Document Sheet (zero overlap with footer) */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-100/60 dark:bg-neutral-900/20 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-7 sm:px-10 sm:py-8 shadow-xs">
          <ConsentKopHeader title="PERSETUJUAN UMUM" documentCode="RM-02" />

          <ol className="space-y-4 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 text-justify">
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">1.</span>
              <div>
                <span className="font-bold text-neutral-900 dark:text-white">HAK DAN KEWAJIBAN PASIEN, </span>
                Saya mengakui bahwa pada saat proses pendaftaran untuk mendapatkan perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan penandatanganan dokumen ini, saya telah mendapat informasi tentang hak-hak dan kewajiban saya sebagai pasien.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">2.</span>
              <div>
                <span className="font-bold text-neutral-900 dark:text-white">PERSETUJUAN PELAYANAN KESEHATAN, </span>
                Saya menyetujui dan memberikan kuasa kepada Klinik Rawat Inap Utama Muhammadiyah Kedungadem, dokter, perawat dan tenaga kesehatan lainnya untuk memberikan asuhan keperawatan, pemeriksaan fisik, prosedur diagnostik, radiologi, terapi dan tata laksana yang diperlukan atau yang disarankan kepada saya. Hal ini mencakup juga pemberian dan/atau tindakan medis atau tindakan penunjang (intramuskular, intravena, dan prosedur invasif lain), produk farmasi dan obat-obatan, pemasangan alat kesehatan (kecuali yang membutuhkan persetujuan khusus dalam bentuk tertulis), pengambilan darah untuk pemeriksaan laboratorium atau pemeriksaan patologi yang dibutuhkan untuk pengobatan dan tindakan yang aman.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">3.</span>
              <div>
                <span className="font-bold text-neutral-900 dark:text-white">PRIVASI DAN RAHASIA KEDOKTERAN, </span>
                Saya setuju dan memberikan kuasa kepada Klinik Rawat Inap Utama Muhammadiyah Kedungadem untuk menjaga privasi, menjamin kerahasiaan kedokteran, penyakit, hasil pemeriksaan penunjang dan hasil pemeriksaan fisik lain, baik untuk kepentingan pengobatan, pendidikan maupun penelitian selama dalam proses perawatan, kecuali saya mengungkapkan sendiri atau orang lain yang saya beri kuasa sebagai penjamin.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">4.</span>
              <div className="space-y-1.5">
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white">MEMBUKA RAHASIA KEDOKTERAN, </span>
                  Saya setuju untuk membuka rahasia kedokteran terkait dengan kondisi kesehatan, asuhan dan pengobatan yang saya terima kepada:
                </div>
                <ol className="list-[lower-alpha] pl-5 space-y-1">
                  <li>Dokter dan tenaga kesehatan lain yang memberikan asuhan kepada saya</li>
                  <li>Perusahaan asuransi kesehatan atau perusahaan lainnya atau pihak lain yang menjamin pembiayaan saya</li>
                  <li>Tenaga praktek kesehatan yang berpartisipasi dan/atau terlibat dalam perawatan saya sepanjang di bawah supervisi dokter penanggung jawab, Orang lain yang saya beri kuasa (diisi pada form di bawah).</li>
                </ol>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">5.</span>
              <div>
                <span className="font-bold text-neutral-900 dark:text-white">BARANG PRIBADI, </span>
                Saya setuju untuk tidak membawa barang-barang berharga yang tidak diperlukan (seperti perhiasan, barang elektronik, dll kecuali uang yang harus dititipkan di kasir) selama dalam perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem. Dan saya mengetahui bahwa Klinik Rawat Inap Utama Muhammadiyah Kedungadem memfasilitasi penitipan barang berharga di Pos Satpam selama masa perawatan, apabila barang berharga tersebut tidak dititipkan, maka Klinik Rawat Inap Utama Muhammadiyah Kedungadem tidak bertanggung jawab terhadap kehilangan, kerusakan atau pencurian.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">6.</span>
              <div>
                <span className="font-bold text-neutral-900 dark:text-white">PENGAJUAN KELUHAN, </span>
                Saya menyatakan bahwa saya telah menerima informasi tentang adanya tata cara mengajukan dan mengatasi keluhan terkait pelayanan medis yang diberikan terhadap diri saya. Saya setuju untuk mengikuti tata cara mengajukan keluhan sesuai prosedur yang ada.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white mt-0.5 shrink-0 w-5">7.</span>
              <div className="space-y-1.5">
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white">KEWAJIBAN PEMBAYARAN, </span>
                  Saya menyatakan sebagai wali/pasien bersedia membayar seluruh biaya pelayanan sesuai pelayanan yang diberikan. Saya juga memahami bahwa:
                </div>
                <ol className="list-[lower-alpha] pl-5 space-y-1">
                  <li>Apabila saya tidak memberikan atau mencabut persetujuan pembukaan rahasia kedokteran kepada pihak asuransi/penjamin, maka seluruh biaya pelayanan menjadi tanggung jawab saya pribadi.</li>
                  <li>Apabila diperlukan proses hukum untuk penagihan biaya pelayanan, maka seluruh biaya yang timbul akibat proses tersebut menjadi tanggung jawab saya.</li>
                </ol>
              </div>
            </li>
          </ol>

          <div className="mt-7 border-l-4 border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900 px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-neutral-900 dark:text-white">
            SAYA TELAH MEMBACA DAN SEPENUHNYA SETUJU DENGAN PERNYATAAN YANG TERDAPAT DALAM FORMULIR INI
          </div>
        </div>
      </div>

      {/* Pinned Clean Footer Action Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 sm:px-6">
        <div className="text-xs text-muted-foreground">
          {isFullySigned
            ? signerName
              ? `Ditandatangani oleh: ${signerName}`
              : "Dokumen persetujuan sudah ditandatangani lengkap."
            : "Pastikan pasien atau penanggung jawab telah membaca seluruh poin sebelum tanda tangan."}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isFullySigned ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm("Apakah Anda yakin ingin menghapus semua tanda tangan untuk dokumen ini?")) return;
                  setSaving(true);
                  try {
                    await signatureApi.resetDocumentSignatures(DOCUMENT_TYPES.GENERAL_CONSENT, Number(visitId));
                    toast({ variant: "success", title: "Tanda tangan berhasil dihapus" });
                    setSignatureStatus(null);
                    setSignDialogOpen(true);
                  } catch {
                    toast({ variant: "destructive", title: "Gagal menghapus tanda tangan" });
                  } finally {
                    setSaving(false);
                  }
                }}
                className="h-9 rounded-none border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={saving}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Hapus TTD
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePrint}
                className="h-9 rounded-none bg-neutral-900 px-5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Cetak Dokumen
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={saving}
              size="sm"
              className="h-9 rounded-none bg-neutral-900 px-5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  Lanjut Tanda Tangan
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

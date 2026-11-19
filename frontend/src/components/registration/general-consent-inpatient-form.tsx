import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsentInpatient } from "@/lib/api/medical-records";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Printer, Trash2, FileText, CheckCircle2, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { DOCUMENT_TYPES, signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ConsentKopHeader } from "./consent-kop-header";

interface GeneralConsentInpatientFormProps {
  visitId: number;
}

export function GeneralConsentInpatientForm({ visitId }: GeneralConsentInpatientFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<DocumentSignatureStatus | null>(null);
  const [consentId, setConsentId] = useState<number | null>(null);

  const form = useForm<GeneralConsentInpatient>({
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
    },
  });

  useEffect(() => {
    const fetchConsent = async () => {
      try {
        setLoading(true);
        const res = await medicalRecordsApi.getGeneralConsentInpatient(visitId);
        if (res.data?.data) {
          form.reset({
            ...res.data.data,
            visit_id: visitId,
          });

          try {
            if (res.data.data.id) {
              setConsentId(res.data.data.id);
              const sigRes = await signatureApi.getDocumentSignature(
                DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT,
                Number(visitId)
              );
              setSignatureStatus(sigRes.data);
            }
          } catch {
            console.error("No signature found");
          }
        }
      } catch (err) {
        console.error("Failed to load general consent inpatient", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConsent();
  }, [visitId, form]);

  const onSubmit = async (data: GeneralConsentInpatient) => {
    try {
      setSaving(true);
      const saveRes = await medicalRecordsApi.saveGeneralConsentInpatient(visitId, data);

      if (saveRes.data?.data?.id) {
        form.setValue("id", saveRes.data.data.id);
        setConsentId(saveRes.data.data.id);
      } else {
        console.warn("Save API did not return an ID", saveRes.data);
      }

      toast({
        title: "Tersimpan",
        description: "Persetujuan Rawat Inap berhasil disimpan",
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
    window.open(`${apiUrl}/print/general-consent-inpatient/${visitId}?token=${token}`, "_blank");
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
          documentType={DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT}
          documentTitle="Persetujuan Rawat Inap (RM-03)"
          steps={[
            { role: "right", title: "Tanda Tangan Penanggung Jawab", type: "patient_or_family" },
            { role: "left", title: "Tanda Tangan Petugas", type: "employee" },
          ]}
          onStepSuccess={async (role, name) => {
            const currentData = form.getValues();
            const updatedFields: Partial<GeneralConsentInpatient> = {};
            if (role === "right" || role === "pasien") updatedFields.signer_name = name;
            if ((role === "left" || role === "petugas") && "signer_name_petugas" in updatedFields) {
              (updatedFields as any).signer_name_petugas = name;
            }
            try {
              await medicalRecordsApi.saveGeneralConsentInpatient(visitId, {
                ...currentData,
                ...updatedFields,
              });
              form.reset({ ...currentData, ...updatedFields });
            } catch (e) {
              console.error(e);
            }
          }}
          onSuccess={async () => {
            try {
              await medicalRecordsApi.saveGeneralConsentInpatient(visitId, { ...form.getValues() });

              if (consentId) {
                const sigRes = await signatureApi.getDocumentSignature(
                  DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT,
                  Number(visitId)
                );
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
      id="general-consent-inpatient-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 min-h-0 flex-col overflow-hidden"
    >
      {/* Top Document Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="w-3.5 h-3.5 text-neutral-500" />
          <span className="font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
            Persetujuan Rawat Inap
          </span>
          <Badge variant="outline" className="rounded-none font-mono text-[10px]">
            RM-03
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

      {/* Scrollable Legal Document Sheet */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-100/60 dark:bg-neutral-900/20 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-7 sm:px-10 sm:py-8 shadow-xs">
          <ConsentKopHeader
            title="KEWAJIBAN PASIEN, HAK PASIEN DAN KELUARGA, DAN PERATURAN KLINIK"
            documentCode="RM-03"
          />

          <div className="space-y-6 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 text-justify">
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                A. Kewajiban Pasien
              </h4>
              <p className="text-xs text-neutral-500">
                (Berdasarkan Permenkes No. 4 Tahun 2018 Pasal 26 tentang Kewajiban Klinik dan Kewajiban Pasien)
              </p>
              <p>Dalam menerima pelayanan dari Klinik Rawat Inap Utama Muhammadiyah Kedungadem, pasien mempunyai kewajiban:</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Mematuhi peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Menggunakan fasilitas Klinik Rawat Inap Utama Muhammadiyah Kedungadem secara bertanggung jawab.</li>
                <li>Menghormati hak-hak pasien lain, pengunjung dan hak tenaga kesehatan serta petugas lainnya yang bekerja di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Memberikan informasi yang jujur, lengkap dan akurat sesuai kemampuan dan pengetahuannya tentang masalah kesehatannya.</li>
                <li>Memberikan informasi mengenai kemampuan finansial dan jaminan kesehatan yang dimilikinya.</li>
                <li>Mematuhi rencana terapi yang direkomendasikan oleh tenaga kesehatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan disetujui oleh pasien yang bersangkutan setelah mendapatkan penjelasan sesuai ketentuan peraturan perundang-undangan.</li>
                <li>Menerima segala konsekuensi atas keputusan pribadinya untuk menolak rencana terapi yang direkomendasikan oleh tenaga kesehatan dan/atau tidak mematuhi petunjuk yang diberikan oleh tenaga kesehatan dalam rangka penyembuhan penyakit atau masalah kesehatannya.</li>
                <li>Memberikan imbalan jasa atas pelayanan yang diterima.</li>
              </ol>
            </section>

            <section className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                B. Hak Pasien dan Keluarga
              </h4>
              <p className="text-xs text-neutral-500">
                (Berdasarkan UU No. 44 Tahun 2009 Pasal 32 dan Permenkes No. 4 Tahun 2018)
              </p>
              <p>Setiap pasien mempunyai hak:</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Memperoleh informasi mengenai tata tertib dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Memperoleh informasi tentang hak dan kewajiban pasien.</li>
                <li>Memperoleh layanan yang manusiawi, adil, jujur dan tanpa diskriminasi.</li>
                <li>Memperoleh layanan kesehatan yang bermutu sesuai dengan standar profesi dan standar prosedur operasional.</li>
                <li>Memperoleh layanan kesehatan yang efektif dan efisien sehingga terhindar dari kerugian fisik dan materi.</li>
                <li>Mengajukan pengaduan atas kualitas pelayanan yang didapatkan.</li>
                <li>Memilih dokter, dokter gigi dan kelas perawatan sesuai dengan keinginannya dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Meminta konsultasi tentang penyakit yang dideritanya kepada dokter lain yang mempunyai surat izin praktik (SIP) baik di dalam maupun di luar Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Mendapatkan privasi dan kerahasiaan penyakit yang diderita termasuk data-data medisnya.</li>
                <li>Mendapat informasi yang meliputi diagnosis dan tata cara tindakan medis, tujuan tindakan medis, alternatif tindakan, risiko dan komplikasi yang mungkin terjadi, prognosis terhadap tindakan yang dilakukan serta perkiraan biaya pengobatan.</li>
                <li>Memberikan persetujuan atau penolakan atas tindakan yang dilakukan oleh tenaga kesehatan terhadap penyakit yang dideritanya.</li>
                <li>Didampingi keluarganya dalam keadaan kritis.</li>
                <li>Menjalankan ibadah sesuai agama atau kepercayaan yang dianutnya selama hal itu tidak mengganggu pasien lain.</li>
                <li>Memperoleh keamanan dan keselamatan dirinya selama dalam perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Mengajukan usul, saran, perbaikan atas perlakuan Klinik Rawat Inap Utama Muhammadiyah Kedungadem terhadap dirinya.</li>
                <li>Menolak pelayanan bimbingan rohani yang tidak sesuai dengan agama dan kepercayaan yang dianutnya.</li>
                <li>Menggugat dan/atau menuntut apabila Klinik Rawat Inap Utama Muhammadiyah Kedungadem memberikan pelayanan yang tidak sesuai dengan standar baik secara perdata ataupun pidana.</li>
                <li>Mengeluhkan pelayanan Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan standar pelayanan melalui media cetak dan elektronik sesuai dengan ketentuan peraturan perundang-undangan.</li>
              </ol>
            </section>

            <section className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                C. Peraturan Klinik Rawat Inap Utama Muhammadiyah Kedungadem
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Dilarang merokok di lingkungan Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                <li>Dilarang menggunakan sarana dan prasarana Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan peruntukannya.</li>
                <li>Dilarang membuat kegaduhan atau keributan yang dapat mengganggu pasien.</li>
                <li>Dilarang memasuki area dengan tanda dilarang masuk atau hanya khusus bagi karyawan.</li>
              </ol>
            </section>
          </div>

          <div className="mt-7 border-l-4 border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900 px-4 py-3.5 text-xs font-semibold leading-relaxed text-neutral-900 dark:text-white">
            Dengan ini saya menyatakan telah memahami hak dan kewajiban serta peraturan Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan bersedia mematuhi peraturan tersebut selama mendapat pelayanan.
          </div>
        </div>
      </div>

      {/* Pinned Clean Footer Action Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 sm:px-6">
        <div className="text-xs text-muted-foreground">
          {isFullySigned
            ? signerName
              ? `Ditandatangani oleh: ${signerName}`
              : "Dokumen persetujuan rawat inap sudah ditandatangani lengkap."
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
                    await signatureApi.resetDocumentSignatures(
                      DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT,
                      Number(visitId)
                    );
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

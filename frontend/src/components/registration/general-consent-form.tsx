import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsent } from "@/lib/api/medical-records";
import { DOCUMENT_TYPES, signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, Printer, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

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
          } catch (e) {
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

  // const handleSignSuccess = () => {
  //   setSignDialogOpen(false);
  //   if (consentId) {
  //     signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT, Number(visitId))
  //       .then(res => setSignatureStatus(res.data))
  //       .catch(err => console.error("Failed to fetch signature status:", err));
  //   }
  // };

  const handlePrint = () => {
    const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8080/api` : 'http://localhost:8080/api');
    const token = localStorage.getItem('token');
    window.open(`${apiUrl}/print/general-consent/${visitId}?token=${token}`, "_blank");
  };

  const isFullySigned = signatureStatus?.is_fully_signed || false;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (signDialogOpen && consentId) {
    return (
      <div className="w-full flex flex-col h-full min-h-[500px]">
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
              <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Data Penanggung Jawab (Yang Menyatakan)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nama Penanggung Jawab</Label>
                      <Input {...form.register("pj_nama")} placeholder="Nama lengkap..." />
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
                          <SelectTrigger>
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
                      <Input {...form.register("pj_no_identitas")} placeholder="Nomor identitas..." />
                    </div>
                    <div className="space-y-2">
                      <Label>No. Telepon</Label>
                      <Input {...form.register("pj_no_telp")} placeholder="Nomor telepon..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Hubungan dengan Pasien</Label>
                      <Input {...form.register("pj_hubungan")} placeholder="Contoh: Suami/Istri/Anak/dll..." />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Alamat Lengkap</Label>
                      <Textarea {...form.register("pj_alamat")} placeholder="Alamat lengkap..." className="min-h-[80px]" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onClose()}>Batal</Button>
                  <Button onClick={() => {
                    const name = form.getValues("pj_nama");
                    if (!name || name.trim() === "") {
                      toast({ variant: "destructive", title: "Nama Penanggung Jawab wajib diisi" });
                      return;
                    }
                    onClose(name);
                  }}>
                    Simpan & Lanjutkan
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
    <div className="space-y-6 w-full pb-10">
      <form id="general-consent-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col">
        {/* Naskah Persetujuan */}
        <Card className="shadow-sm overflow-hidden flex flex-col">
          <CardContent className="pt-0 px-0 overflow-y-auto max-h-[65vh] border-b">
            <div className="w-full px-6 py-6 text-sm leading-relaxed text-justify text-muted-foreground space-y-4">
              <h3 className="font-bold uppercase text-center mb-6 text-black underline underline-offset-4">PERSETUJUAN UMUM</h3>
              <ol className="list-decimal pl-5 space-y-3">
                <li><span className="font-bold text-black">HAK DAN KEWAJIBAN PASIEN,</span> Saya mengakui bahwa pada saat proses pendaftaran untuk mendapatkan perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan penandatanganan dokumen ini, saya telah mendapat informasi tentang hak-hak dan kewajiban saya sebagai pasien.</li>
                <li><span className="font-bold text-black">PERSETUJUAN PELAYANAN KESEHATAN,</span> Saya menyetujui dan memberikan kuasa kepada Klinik Rawat Inap Utama Muhammadiyah Kedungadem, dokter, perawat dan tenaga kesehatan lainnya untuk memberikan asuhan keperawatan, pemeriksaan fisik, prosedur diagnostik, radiologi, terapi dan tata laksana yang diperlukan atau yang disarankan kepada saya. Hal ini mencakup juga pemberian dan/atau tindakan medis atau tindakan penunjang (intramuskular, intravena, dan prosedur invasif lain), produk farmasi dan obat-obatan, pemasangan alat kesehatan (kecuali yang membutuhkan persetujuan khusus dalam bentuk tertulis), pengambilan darah untuk pemeriksaan laboratorium atau pemeriksaan patologi yang dibutuhkan untuk pengobatan dan tindakan yang aman.</li>
                <li><span className="font-bold text-black">PRIVASI DAN RAHASIA KEDOKTERAN,</span> Saya setuju dan memberikan kuasa kepada Klinik Rawat Inap Utama Muhammadiyah Kedungadem untuk menjaga privasi, menjamin kerahasiaan kedokteran, penyakit, hasil pemeriksaan penunjang dan hasil pemeriksaan fisik lain, baik untuk kepentingan pengobatan, pendidikan maupun penelitian selama dalam proses perawatan, kecuali saya mengungkapkan sendiri atau orang lain yang saya beri kuasa sebagai penjamin.</li>
                <li>
                  <span className="font-bold text-black">MEMBUKA RAHASIA KEDOKTERAN,</span> Saya setuju untuk membuka rahasia kedokteran terkait dengan kondisi kesehatan, asuhan dan pengobatan yang saya terima kepada:
                  <ol className="list-[lower-alpha] pl-5 mt-1 space-y-1">
                    <li>Dokter dan tenaga kesehatan lain yang memberikan asuhan kepada saya</li>
                    <li>Perusahaan asuransi kesehatan atau perusahaan lainnya atau pihak lain yang menjamin pembiayaan saya</li>
                    <li>Tenaga praktek kesehatan yang berpartisipasi dan/atau terlibat dalam perawatan saya sepanjang di bawah supervisi dokter penanggung jawab, Orang lain yang saya beri kuasa (diisi pada form di bawah).</li>
                  </ol>
                </li>
                <li><span className="font-bold text-black">BARANG PRIBADI,</span> Saya setuju untuk tidak membawa barang-barang berharga yang tidak diperlukan (seperti perhiasan, barang elektronik, dll kecuali uang yang harus dititipkan di kasir) selama dalam perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem. Dan saya mengetahui bahwa Klinik Rawat Inap Utama Muhammadiyah Kedungadem memfasilitasi penitipan barang berharga di Pos Satpam selama masa perawatan, apabila barang berharga tersebut tidak dititipkan, maka Klinik Rawat Inap Utama Muhammadiyah Kedungadem tidak bertanggung jawab terhadap kehilangan, kerusakan atau pencurian.</li>
                <li><span className="font-bold text-black">PENGAJUAN KELUHAN,</span> Saya menyatakan bahwa saya telah menerima informasi tentang adanya tata cara mengajukan dan mengatasi keluhan terkait pelayanan medis yang diberikan terhadap diri saya. Saya setuju untuk mengikuti tata cara mengajukan keluhan sesuai prosedur yang ada.</li>
                <li>
                  <span className="font-bold text-black">KEWAJIBAN PEMBAYARAN,</span> Saya menyatakan sebagai wali/pasien bersedia membayar seluruh biaya pelayanan sesuai pelayanan yang diberikan. Saya juga memahami bahwa :
                  <ol className="list-[lower-alpha] pl-5 mt-1 space-y-1">
                    <li>Apabila saya tidak memberikan atau mencabut persetujuan pembukaan rahasia kedokteran kepada pihak asuransi/penjamin, maka seluruh biaya pelayanan menjadi tanggung jawab saya pribadi.</li>
                    <li>Apabila diperlukan proses hukum untuk penagihan biaya pelayanan, maka seluruh biaya yang timbul akibat proses tersebut menjadi tanggung jawab saya.</li>
                  </ol>
                </li>
              </ol>
              <p className="font-bold text-black text-center mt-6 pt-4 border-t uppercase">
                SAYA TELAH MEMBACA DAN SEPENUHNYA SETUJU DENGAN PERNYATAAN YANG TERDAPAT DALAM FORMULIR INI
              </p>
            </div>
          </CardContent>

          {/* Action Buttons (Static Footer of the Card) */}
          <div className="p-4 bg-gray-50/80 backdrop-blur-sm flex justify-end gap-3 rounded-b-lg">
            {isFullySigned ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Apakah Anda yakin ingin menghapus semua tanda tangan untuk dokumen ini?")) return;
                    setSaving(true);
                    try {
                      await signatureApi.resetDocumentSignatures(DOCUMENT_TYPES.GENERAL_CONSENT, Number(visitId));
                      toast({ variant: "success", title: "Tanda tangan berhasil dihapus" });
                      setSignatureStatus(null);
                      setSignDialogOpen(true);
                    } catch (error: any) {
                      toast({ variant: "destructive", title: "Gagal menghapus tanda tangan" });
                    } finally {
                      setSaving(false);
                    }
                  }}
                  size="lg"
                  className="font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={saving}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus TTD
                </Button>
                <Button type="button" onClick={handlePrint} size="lg" className="font-bold px-8">
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto font-bold px-8">
                {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Lanjut Tanda Tangan"}
                {!saving && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
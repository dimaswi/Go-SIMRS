import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsentInpatient } from "@/lib/api/medical-records";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { DOCUMENT_TYPES, signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { Printer, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

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

  // const signerRelation = form.watch("signer_relation");

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
              const sigRes = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT, Number(visitId));
              setSignatureStatus(sigRes.data);
            }
          } catch (e) {
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

      // Use the returned data from the save operation directly
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

  const handleSignSuccess = () => {
    setSignDialogOpen(false);
    if (consentId) {
      signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT, Number(visitId))
        .then(res => setSignatureStatus(res.data))
        .catch(err => console.error("Failed to fetch signature status:", err));
    }
  };

  const handlePrint = () => {
    const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8080/api` : 'http://localhost:8080/api');
    const token = localStorage.getItem('token');
    window.open(`${apiUrl}/print/general-consent-inpatient/${visitId}?token=${token}`, "_blank");
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
            if ((role === "left" || role === "petugas") && 'signer_name_petugas' in updatedFields) {
              (updatedFields as any).signer_name_petugas = name;
            }
            try {
              await medicalRecordsApi.saveGeneralConsentInpatient(visitId, { ...currentData, ...updatedFields });
              form.reset({ ...currentData, ...updatedFields });
            } catch (e) {
              console.error(e);
            }
          }}
          onSuccess={async () => {
            try {
              await medicalRecordsApi.saveGeneralConsentInpatient(visitId, { ...form.getValues() });

              if (consentId) {
                // Fetch the new signature status using the correct ID
                const sigRes = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT, Number(visitId));
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
      <form id="general-consent-inpatient-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col">
        {/* Naskah Persetujuan (Scrollable Box) */}
        <Card className="shadow-sm overflow-hidden flex flex-col">
          {/* Scrollable Text Area */}
          <CardContent className="pt-0 px-0 overflow-y-auto max-h-[65vh] border-b">
            <div className="w-full px-6 py-6 text-sm leading-relaxed">
              <h3 className="font-bold mb-4 text-center uppercase">KEWAJIBAN PASIEN, HAK PASIEN DAN KELUARGA, DAN HAK KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-justify mb-2">
                    <span className="font-bold text-black">KEWAJIBAN PASIEN</span> (Berdasarkan Permenkes No. 4 Tahun 2018 Pasal 26 tentang kewajiban Klinik Rawat Inap Utaa
                    Muhammadiyah Kedungadem dan Kewajiban pasien) Dalam menerima pelayanan dari Klinik Rawat Inap Utaa
                    Muhammadiyah Kedungadem, pasien mempunyai kewajiban :
                  </p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li className="text-justify">Mematuhi peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Menggunakan fasilitas Klinik Rawat Inap Utama Muhammadiyah Kedungadem secara bertanggung jawab.</li>
                    <li className="text-justify">Menghormati hak-hak pasien lain, pengunjung dan hak tenaga kesehatan serta petugas lainnya yang bekerja di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Memberikan informasi yang jujur, lengkap dan akurat sesuai kemampuan dan pengetahuannya tentang masalah kesehatannya.</li>
                    <li className="text-justify">Memberikan informasi mengenai kemampuan finansial dan jaminan kesehatan yang dimilikinya.</li>
                    <li className="text-justify">Mematuhi rencana terapi yang direkomendasikan oleh tenaga kesehatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan disetujui oleh pasien yang bersangkutan setelah mendapatkan penjelasan sesuai ketentuan peraturan perundang-undangan.</li>
                    <li className="text-justify">Menerima segala konsekuensi atas keputusan pribadinya untuk menolak rencana terapi yang direkomendasikan oleh tenaga kesehatan dan/atau tidak mematuhi petunjuk yang diberikan oleh tenaga kesehatan dalam rangka penyembuhan penyakit atau masalah kesehatannya dan</li>
                    <li className="text-justify">Memberikan imbalan jasa atas pelayanan yang diterima.</li>
                  </ol>
                </div>

                <div>
                  <p className="text-justify mb-2">
                    <span className="font-bold text-black">HAK PASIEN DAN KELUARGA</span> (Berdasarkan UU No. 44 Tahun 2009 Pasal 32 Tentang hak pasien dan keluarga dn
                    Peraturan Menteri Kesehatan Republik Indonesia No. 4 Tahun 2018 Tentang kewajiban Klinik Rawat Inap Utaa
                    Muhammadiyah Kedungadem dan Kewajiban Pasien).< br />
                    Setiap pasien mempunyai hak :
                  </p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li className="text-justify">Memperoleh informasi mengenai tata tertib dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem</li>
                    <li className="text-justify">Memperoleh informasi tentang hak dan kewajiban pasien.</li>
                    <li className="text-justify">Memperoleh layanan yang manusiawi, adil jujur dan tanpa diskriminasi.</li>
                    <li className="text-justify">Memperoleh layanan kesehatan yang bermutu sesuai dengan standart profesi dan standart prosedur operasional.</li>
                    <li className="text-justify">Memperoleh layanan kesehatan yang efektif dan efisien sehingga terhindar dari kerugian fisik dan materi.</li>
                    <li className="text-justify">Mengajukan pengaduan atas kualitas pelayanan yang didapatkan.</li>
                    <li className="text-justify">Memilih dokter, dokter gigi dan kelas perawatan sesuai dengan keinginannya dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Meminta konsultasi tentang penyakit yang dideritanya kepada dokter lain yang mempunyai surat ijin praktek (SIP) baik di dalam maupun diluar Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Mendapatkan Privasi dan kerahasiaan penyakit yang diderita termasuk data-data medisnya.</li>
                    <li className="text-justify">Mendapat informasi yang meliputi diagnosis dan tata cara tindakan medis, tujuan tindakan medis, alternatif tindakan, resiko dan komplikasi yang mungkin terjadi, dan prognosis terhadap tindakan yang dilakukan serta perkiraan biaya pengobatan.</li>
                    <li className="text-justify">Memberikan persetujuan atau penolakan atas tindakan yang dilakukan oleh tenaga kesehatan terhadap penyakit yang dideritanya.</li>
                    <li className="text-justify">Didampingi keluarganya dalam keadaan kritis.</li>
                    <li className="text-justify">Menjalankan ibadah sesuai Agama atau kepercayaan yang dianutnya selama hal itu tidak mengganggu pasien lain.</li>
                    <li className="text-justify">Memperoleh keamanan dan keselamatan dirinya selama dalam perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Mengajukan usul, saran, perbaikan atas perlakuan Klinik Rawat Inap Utama Muhammadiyah Kedungadem terhadap dirinya.</li>
                    <li className="text-justify">Menolak pelayanan bimbingan rohani yang tidak sesuai dengan Agama dan Kepercayaan yang dianutnya.</li>
                    <li className="text-justify">Menggugat dan / atau menuntut Klinik Rawat Inap Utama Muhammadiyah Kedungadem memberikan pelayanan yang tidak sesuai dengan standart baik secara perdata ataupun pidana dan</li>
                    <li className="text-justify">Mengeluhkan pelayanan Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan standart pelayanan melalui media cetak dan elektronik sesuai dengan ketentuan peraturan perundang-undangan.</li>
                  </ol>
                </div>

                <div>
                  <p className="font-bold text-black text-justify mb-2">
                    PERATURAN KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM.
                  </p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li className="text-justify">Dilarang merokok di lingkungan Klinik Rawat Inap Utama Muhammadiyah Kedungadem.</li>
                    <li className="text-justify">Dilarang menggunakan sarana dan prasarana Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan peruntukannya.</li>
                    <li className="text-justify">Dilarang membuat kegaduhan atau keributan yang dapat mengganggu pasien.</li>
                    <li className="text-justify">Dilarang memasuki area dengan tanda dilarang masuk atau hanya khusus bagi karyawan.</li>
                  </ol>
                </div>

                <p className="text-justify mt-6 pt-4 border-t font-medium text-black">
                  Dengan ini saya menyatakan telah memahami hak dan kewajiban serta peraturan Klinik Rawat Inap Utama Muhammadiyh
                  Kedungadem dan mematuhi peraturan tersebut selama mendapat pelayanan di Klinik Rawat Inap Utama Muhammadiyh
                  Kedungadem.
                </p>
              </div>
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
                      await signatureApi.resetDocumentSignatures(DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT, Number(visitId));
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

      {signDialogOpen && consentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <SequentialSignatureWizard
              documentId={Number(visitId)}
              documentType={DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT}
              visitId={visitId}
              steps={[
                { role: "right", title: "Tanda Tangan Pasien/Wali", type: "patient_or_family" },
                { role: "left", title: "Tanda Tangan Petugas", type: "employee" },
              ]}
              onSuccess={handleSignSuccess}
              onCancel={() => setSignDialogOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}

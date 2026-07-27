import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsent } from "@/lib/api/medical-records";
import { DOCUMENT_TYPES } from "@/lib/api/signature";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";

interface GeneralConsentFormProps {
  visitId: number;
}

export function GeneralConsentForm({ visitId }: GeneralConsentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const form = useForm<GeneralConsent>({
    defaultValues: {
      visit_id: visitId,
      signer_relation: "pasien",
      signer_name: "",
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
      await medicalRecordsApi.saveGeneralConsent(visitId, data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (signDialogOpen) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-10 bg-white">
        <SequentialSignatureWizard
          visitId={visitId}
          documentId={visitId}
          documentType={DOCUMENT_TYPES.GENERAL_CONSENT}
          documentTitle="Persetujuan Umum (RM-02)"
          steps={[
            { role: "pasien", title: "Tanda Tangan Pasien/Wali", type: "patient_or_family" },
            { role: "petugas", title: "Tanda Tangan Petugas", type: "employee" },
          ]}
          onStepSuccess={async (role, name) => {
            const currentData = form.getValues();
            const updatedFields: Partial<GeneralConsent> = {};
            if (role === "pasien") updatedFields.signer_name = name;
            
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <form id="general-consent-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Naskah Persetujuan Terbuka Penuh */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm text-justify leading-relaxed text-muted-foreground space-y-4">
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
                    <li>Apabila saya tidak memberikan atau mencabut persetujuan pembukaan rahasia kedokteran kepada pihak asuransi/penjamin, maka seluruh biaya pelayanan menjadi tanggung jawab saya pribadi..</li>
                    <li>Apabila diperlukan proses hukum untuk penagihan biaya pelayanan, maka seluruh biaya yang timbul akibat proses tersebut menjadi tanggung jawab saya..</li>
                  </ol>
                </li>
              </ol>
              <p className="font-bold text-black text-center mt-6 pt-4 border-t uppercase">
                SAYA TELAH MEMBACA DAN SEPENUHNYA SETUJU DENGAN PERNYATAAN YANG TERDAPAT DALAM FORMULIR INI
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-end gap-3 mt-8 z-10">
          <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto font-bold px-8">
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Lanjut Tanda Tangan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
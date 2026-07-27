import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { medicalRecordsApi, type GeneralConsentInpatient } from "@/lib/api/medical-records";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { SequentialSignatureWizard } from "@/components/signature/sequential-signature-wizard";
import { DOCUMENT_TYPES } from "@/lib/api/signature";

interface GeneralConsentInpatientFormProps {
  visitId: number;
}

export function GeneralConsentInpatientForm({ visitId }: GeneralConsentInpatientFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const form = useForm<GeneralConsentInpatient>({
    defaultValues: {
      visit_id: visitId,
      signer_relation: "pasien",
      signer_name: "",
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
      await medicalRecordsApi.saveGeneralConsentInpatient(visitId, data);
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
          documentId={visitId}
          documentType={DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT}
          documentTitle="Persetujuan Rawat Inap (RM-03)"
          steps={[
            { role: "pasien", title: "Tanda Tangan Pasien/Wali", type: "patient_or_family" },
            { role: "petugas", title: "Tanda Tangan Petugas", type: "employee" },
          ]}
          onStepSuccess={async (role, name) => {
            const currentData = form.getValues();
            const updatedFields: Partial<GeneralConsentInpatient> = {};
            if (role === "pasien") updatedFields.signer_name = name;
            // Petugas might not have a specific signer_name field in GeneralConsentInpatient, but just in case:
            if (role === "petugas" && 'signer_name_petugas' in updatedFields) {
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
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col h-full">

      <form id="general-consent-inpatient-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
        {/* Naskah Persetujuan (Scrollable) */}
        <Card className="shadow-sm">
          <CardContent className="pt-0 px-0">
            <div className="w-full px-6 py-4 text-sm leading-relaxed">
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
        </Card>

        {/* Action Buttons */}
        <div className="sticky bottom-0 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 mt-auto p-4 bg-white border-t flex justify-end gap-3 z-10">
          <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto font-bold px-8">
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Lanjut Tanda Tangan"}
            {!saving && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

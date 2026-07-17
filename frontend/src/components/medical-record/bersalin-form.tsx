import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { medicalRecordsApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import type { BersalinRecord } from "@/lib/api";
import { emitMedicalRecordTabsSaved, emitMedicalRecordTabSaved } from "./tab-indicator";
import { useToast } from "@/hooks/use-toast";

interface BersalinFormProps {
  visitId: number;
  patientId?: number;
  onSave?: (data: any) => void;
  isPatientDischarged?: boolean;
  initialTab?: string;
}

const defaultFormData: Partial<BersalinRecord> = {
  jam_datang: "",
  jam_pengkajian: "",
  anamnesis_type: "Autoanamnesis",
  keluhan_utama: "",
  pemeriksaan_fisik: {},
  genetalia: {},
  skor_norton: 0,
  skor_must: 0,
  skor_barthel: 0,
  skor_morse: 0,
  nyeri: {},
  edukasi: {},
  riwayat_medis: {},
  rencana_asuhan: {},
  ketuban_pecah_jam: "",
  mules_sejak_jam: "",
  lembar_observasi: [],
  partograf_data: {},
  laporan_tindakan: {},
  catatan_kala_1: {},
  catatan_kala_2: {},
  catatan_kala_3: {},
  bayi_baru_lahir: {},
  pemantauan_kala_4: [],
};

import { AsesmenAwalBersalin } from "./bersalin/asesmen-awal-form";
import { SkriningRisikoBersalin } from "./bersalin/skrining-risiko-form";
import { AsesmenMedisBersalin } from "./bersalin/asesmen-medis-form";
import { ObservasiBersalin } from "./bersalin/observasi-form";
import { PartografBersalin } from "./bersalin/partograf-form";
import { CatatanPersalinanBersalin } from "./bersalin/catatan-persalinan-form";
import { BayiBaruLahirBersalin } from "./bersalin/bayi-baru-lahir-form";

export function BersalinForm({
  visitId,
  onSave,
  isPatientDischarged = false,
  initialTab = "asesmen",
}: BersalinFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<BersalinRecord>>(defaultFormData);
  const { toast } = useToast();

  const [signatureStatus, setSignatureStatus] = useState<{ is_signed: boolean; signer_name?: string; signed_at?: string } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getBersalinRecord(visitId);
        if (response.data && response.data.id) {
          setFormData(response.data);

          emitMedicalRecordTabsSaved([
            "bersalin-asesmen",
            "bersalin-skrining",
            "bersalin-medis",
            "bersalin-observasi",
            "bersalin-partograf",
            "bersalin-catatan",
            "bersalin-bayi"
          ], true);
        }
      } catch (error) {
        console.error("Failed to load bersalin record:", error);
      } finally {
        setLoading(false);
      }
    };

    const checkSignatureStatus = async () => {
      try {
        const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.BERSALIN, visitId);
        setSignatureStatus(res.data);
      } catch (err) {
        setSignatureStatus({ is_signed: false });
      }
    };

    loadData();
    checkSignatureStatus();
  }, [visitId]);

  const isReadOnly = Boolean(isPatientDischarged || signatureStatus?.is_signed);

  const handleChange = useCallback((field: keyof BersalinRecord, value: any) => {
    setFormData((prev: Partial<BersalinRecord>) => ({ ...prev, [field]: value }));
    emitMedicalRecordTabSaved(`bersalin-${initialTab}`, false);
  }, [initialTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return; // Prevent save if discharged or signed


    setSaving(true);
    try {
      await medicalRecordsApi.saveBersalinRecord(visitId, formData);
      emitMedicalRecordTabsSaved([
        "bersalin-asesmen",
        "bersalin-skrining",
        "bersalin-medis",
        "bersalin-observasi",
        "bersalin-partograf",
        "bersalin-catatan",
        "bersalin-bayi"
      ], true);
      onSave?.(formData);
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      toast({
        title: "Berhasil",
        description: "Data bersalin berhasil disimpan",
      });
    } catch (error) {
      console.error("Failed to save bersalin record:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan data bersalin",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset
          disabled={isReadOnly}
          className="space-y-8 [&_label]:tracking-[0.01em] [&_input:not(.h-8):not(.h-7)]:h-11 [&_[role=combobox]]:h-11"
        >
          <AsesmenAwalBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <SkriningRisikoBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <AsesmenMedisBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <ObservasiBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <PartografBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <CatatanPersalinanBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />

          <BayiBaruLahirBersalin
            formData={formData}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />
        </fieldset>

        {!isReadOnly && (
          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button type="submit" disabled={saving} size="lg" className="shadow-lg">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Data Bersalin
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
